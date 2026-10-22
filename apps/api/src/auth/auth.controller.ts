import type { AuthProviders, AuthResponse, User } from '@expense/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { CSRF_HEADER, CsrfHeaderGuard } from '../common/auth/csrf.guard';
import { CurrentUserId, Public } from '../common/auth/decorators';
import type { AppConfig } from '../config/configuration';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth.cookies';
import { AuthResult, AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { GoogleOAuthService, GoogleSignInError } from './google-oauth.service';

const csrfHeader = { name: CSRF_HEADER, description: 'Must be "1"', required: true };

/** Holds the state and PKCE verifier between leaving for Google and coming back. */
const GOOGLE_COOKIE = 'et_google';
const GOOGLE_COOKIE_PATH = '/api/v1/auth/google';
const GOOGLE_COOKIE_TTL_MS = 10 * 60 * 1000;

interface GoogleCookie {
  state: string;
  verifier: string;
  next: string;
  timezone?: string;
}

/** Only same-site paths, so the sign-in can never bounce the user to another site. */
function safeNextPath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    value.length <= 512
    ? value
    : '/dashboard';
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get secureCookies() {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }

  private respond(res: Response, result: AuthResult): AuthResponse {
    setAuthCookies(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshExpiresAt,
      this.secureCookies,
    );
    return {
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create an account (seeds default categories) and sign in' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(dto, req.headers['user-agent']));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(dto, req.headers['user-agent']));
  }

  @Public()
  @UseGuards(CsrfHeaderGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiHeader(csrfHeader)
  @ApiOperation({ summary: 'Rotate the refresh-token cookie and get a new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      const result = await this.auth.refresh(
        req.cookies?.[REFRESH_COOKIE],
        req.headers['user-agent'],
      );
      return this.respond(res, result);
    } catch (error) {
      clearAuthCookies(res, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @UseGuards(CsrfHeaderGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiHeader(csrfHeader)
  @ApiOperation({ summary: 'Revoke the current refresh token and clear cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res, this.secureCookies);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email a password reset link (same response whether or not the email exists)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token; signs out all sessions' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.auth.resetPassword(dto);
    return { message: 'Your password has been reset. Please sign in.' };
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Sign-in methods available on this server' })
  providers(): AuthProviders {
    return { google: this.google.enabled };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google')
  @ApiOperation({ summary: 'Start Google sign-in (browser navigation, redirects to Google)' })
  startGoogle(
    @Query('next') next: string | undefined,
    @Query('tz') timezone: string | undefined,
    @Res() res: Response,
  ): void {
    if (!this.google.enabled) throw new NotFoundException('Google sign-in is not configured');
    const request = this.google.createRequest();
    const cookie: GoogleCookie = {
      state: request.state,
      verifier: request.verifier,
      next: safeNextPath(next),
      timezone: typeof timezone === 'string' ? timezone.slice(0, 64) : undefined,
    };
    // Lax (not Strict) so the browser sends it back on the top-level return from Google.
    res.cookie(GOOGLE_COOKIE, Buffer.from(JSON.stringify(cookie)).toString('base64url'), {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: GOOGLE_COOKIE_PATH,
      maxAge: GOOGLE_COOKIE_TTL_MS,
    });
    res.redirect(302, request.url);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google/callback')
  @ApiOperation({ summary: 'Google redirects here; signs in and continues into the app' })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(GOOGLE_COOKIE, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: GOOGLE_COOKIE_PATH,
    });

    let saved: GoogleCookie | null = null;
    try {
      const raw = req.cookies?.[GOOGLE_COOKIE];
      saved = raw
        ? (JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as GoogleCookie)
        : null;
    } catch {
      saved = null;
    }

    try {
      if (!this.google.enabled) throw new GoogleSignInError('not_configured');
      // Google sends ?error=access_denied when the user cancels; code is then missing.
      if (!code || !state || !saved || !sameString(state, saved.state)) {
        throw new GoogleSignInError(code ? 'state_mismatch' : 'cancelled');
      }
      const profile = await this.google.exchangeCode(code, saved.verifier);
      const result = await this.auth.signInWithGoogle(profile, {
        userAgent: req.headers['user-agent'],
        timezone: saved.timezone,
      });
      setAuthCookies(
        res,
        result.tokens.refreshToken,
        result.tokens.refreshExpiresAt,
        this.secureCookies,
      );
      this.continueTo(res, saved.next);
    } catch (error) {
      const reason = error instanceof GoogleSignInError ? error.message : 'failed';
      if (!(error instanceof GoogleSignInError)) {
        this.logger.error('Google sign-in failed', error instanceof Error ? error.stack : error);
      }
      this.continueTo(res, `/login?error=google&reason=${encodeURIComponent(reason)}`);
    }
  }

  /**
   * Finishes on a tiny page that navigates on from our own origin. A plain redirect would
   * still count as part of the cross-site trip from Google, and browsers then withhold the
   * SameSite=Strict session cookies on the next page load.
   */
  private continueTo(res: Response, path: string): void {
    const target = escapeHtml(path);
    res
      .status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      })
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Signing in…</title></head><body><p><a href="${target}">Continue</a></p></body></html>`,
      );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'The signed-in user' })
  me(@CurrentUserId() userId: string): Promise<User> {
    return this.auth.me(userId);
  }
}
