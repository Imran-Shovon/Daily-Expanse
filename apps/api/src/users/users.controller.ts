import type { AuthResponse, User } from '@expense/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { clearAuthCookies, setAuthCookies } from '../auth/auth.cookies';
import { CurrentUserId } from '../common/auth/decorators';
import type { AppConfig } from '../config/configuration';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the signed-in user profile and preferences' })
  get(@CurrentUserId() userId: string): Promise<User> {
    return this.users.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile and preferences (currency, time zone, theme, ...)' })
  update(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto): Promise<User> {
    return this.users.updateProfile(userId, dto);
  }

  @Patch('password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Change password; other sessions are signed out' })
  async changePassword(
    @CurrentUserId() userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.users.changePassword(
      userId,
      dto,
      req.headers['user-agent'],
    );
    setAuthCookies(
      res,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
      this.config.get('COOKIE_SECURE', { infer: true }),
    );
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, user };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Permanently delete the account and all of its data' })
  async remove(
    @CurrentUserId() userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(userId, dto);
    clearAuthCookies(res, this.config.get('COOKIE_SECURE', { infer: true }));
  }
}
