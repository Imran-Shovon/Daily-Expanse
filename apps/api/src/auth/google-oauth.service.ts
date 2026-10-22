import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { AppConfig } from '../config/configuration';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** The verified identity Google returns after a successful sign-in. */
export interface GoogleProfile {
  /** Stable Google account id. */
  sub: string;
  email: string;
  name: string;
}

export class GoogleSignInError extends Error {}

/** One sign-in attempt: `state` guards against forged callbacks, `verifier` is the PKCE secret. */
export interface GoogleAuthRequest {
  url: string;
  state: string;
  verifier: string;
}

const base64url = (buf: Buffer) => buf.toString('base64url');

/**
 * Google sign-in with the OAuth 2.0 authorization-code flow and PKCE. The ID token is taken
 * straight from Google's token endpoint over TLS, authenticated with the client secret, so per
 * OpenID Connect Core 3.1.3.7 its claims are validated without re-checking the signature.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get clientId() {
    return this.config.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  private get clientSecret() {
    return this.config.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Must match an "Authorized redirect URI" on the Google OAuth client exactly. */
  get redirectUri(): string {
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/+$/, '');
    return `${web}/api/v1/auth/google/callback`;
  }

  createRequest(): GoogleAuthRequest {
    const state = base64url(randomBytes(32));
    const verifier = base64url(randomBytes(32));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return { url: `${AUTHORIZE_URL}?${params}`, state, verifier };
  }

  async exchangeCode(code: string, verifier: string): Promise<GoogleProfile> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) {
      // Google's error body names the problem (e.g. redirect_uri_mismatch) without secrets.
      this.logger.warn(
        `Google token exchange failed (${response.status}): ${await response.text()}`,
      );
      throw new GoogleSignInError('token_exchange_failed');
    }
    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    if (!idToken) throw new GoogleSignInError('missing_id_token');
    return this.profileFromIdToken(idToken);
  }

  private profileFromIdToken(idToken: string): GoogleProfile {
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    } catch {
      throw new GoogleSignInError('malformed_id_token');
    }
    const now = Math.floor(Date.now() / 1000);
    if (!ISSUERS.has(String(claims.iss))) throw new GoogleSignInError('wrong_issuer');
    if (claims.aud !== this.clientId) throw new GoogleSignInError('wrong_audience');
    if (typeof claims.exp !== 'number' || claims.exp < now) {
      throw new GoogleSignInError('expired_id_token');
    }
    if (typeof claims.sub !== 'string' || !claims.sub) throw new GoogleSignInError('missing_sub');
    // Only a verified address may sign in to, or be linked with, an existing account.
    if (typeof claims.email !== 'string' || claims.email_verified !== true) {
      throw new GoogleSignInError('unverified_email');
    }
    const email = claims.email.trim().toLowerCase();
    const name =
      typeof claims.name === 'string' && claims.name.trim()
        ? claims.name.trim().slice(0, 80)
        : email.split('@')[0]!;
    return { sub: claims.sub, email, name };
  }
}
