import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import type { AccessTokenPayload } from '../common/auth/jwt-auth.guard';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A rotated token presented again within this window is treated as a benign race (two tabs
 * refreshing at once) instead of theft, so the session survives.
 */
const REUSE_GRACE_MS = 10_000;

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  refreshTokenId: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Keyed hash so a database leak alone cannot be used to forge or verify tokens. */
  hashToken(token: string): string {
    return createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async issue(
    userId: string,
    userAgent?: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    const expiresIn = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const payload: AccessTokenPayload = { sub: userId, type: 'access' };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    const refreshToken = this.generateOpaqueToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 86_400_000,
    );
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return { accessToken, expiresIn, refreshToken, refreshExpiresAt, refreshTokenId: record.id };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one in the same family
   * is issued. Presenting an already-rotated token outside the grace window revokes the whole
   * family, logging out whoever holds the stolen copy.
   */
  async rotate(
    presented: string,
    userAgent?: string,
  ): Promise<{ userId: string; tokens: IssuedTokens }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(presented) },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');

    if (record.revokedAt) {
      const sinceRevoked = Date.now() - record.revokedAt.getTime();
      if (!record.replacedById || sinceRevoked > REUSE_GRACE_MS) {
        this.logger.warn(
          `Refresh token reuse detected; revoking session family for user ${record.userId}`,
        );
        await this.revokeFamily(record.familyId);
      }
      throw new UnauthorizedException('Refresh token is no longer valid');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Conditional update guarantees only one concurrent request can rotate this token.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) throw new UnauthorizedException('Refresh token is no longer valid');

    const tokens = await this.issue(record.userId, userAgent, record.familyId);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { replacedById: tokens.refreshTokenId },
    });
    return { userId: record.userId, tokens };
  }

  async revoke(presented: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
