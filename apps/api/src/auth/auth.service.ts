import type { User as UserDto } from '@expense/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createDefaultCategories } from '../categories/default-categories';
import { toUserDto } from '../common/mappers';
import type { AppConfig } from '../config/configuration';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { PasswordService } from './password.service';
import { IssuedTokens, TokenService } from './token.service';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface AuthResult {
  user: UserDto;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            passwordHash,
            currency: dto.currency ?? 'USD',
            timezone: dto.timezone ?? 'UTC',
          },
        });
        await createDefaultCategories(tx, created.id);
        return created;
      });
      const tokens = await this.tokens.issue(user.id, userAgent);
      return { user: toUserDto(user), tokens };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always run the hash comparison so response time does not reveal whether the email exists.
    const valid = await this.passwords.verify(dto.password, user?.passwordHash);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.tokens.issue(user.id, userAgent);
    return { user: toUserDto(user), tokens };
  }

  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const { userId, tokens } = await this.tokens.rotate(refreshToken, userAgent);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return { user: toUserDto(user), tokens };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }

  /**
   * Always resolves the same way whether or not the email exists, to avoid account
   * enumeration. Previous unused reset tokens are invalidated.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = this.tokens.generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.tokens.hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const link = `${this.config.get('WEB_URL', { infer: true })}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Daily Expense password',
      text: `Hi ${user.name},\n\nUse the link below to choose a new password. It expires in 30 minutes.\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(dto.token) },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await this.passwords.hash(dto.password);
    // Mark used atomically so the same token cannot be redeemed twice concurrently.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0)
        throw new BadRequestException('This reset link is invalid or has expired');
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    this.logger.log(`Password reset completed for user ${record.userId}`);
  }
}
