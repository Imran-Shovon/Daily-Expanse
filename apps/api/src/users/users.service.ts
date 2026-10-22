import type { User as UserDto } from '@expense/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { IssuedTokens, TokenService } from '../auth/token.service';
import { toUserDto } from '../common/mappers';
import { todayInTimeZone, type PlainDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async findOrThrow(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Today's date in the user's own time zone. */
  async today(userId: string): Promise<{ user: User; today: PlainDate }> {
    const user = await this.findOrThrow(userId);
    return { user, today: todayInTimeZone(user.timezone) };
  }

  async getProfile(userId: string): Promise<UserDto> {
    return toUserDto(await this.findOrThrow(userId));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.findOrThrow(userId);
    const { currentPassword, ...changes } = dto;

    if (changes.email && changes.email !== user.email) {
      // Changing the sign-in email needs a password check; Google-only accounts set one first.
      if (!user.passwordHash) {
        throw new BadRequestException('Set a password before changing your email');
      }
      if (!currentPassword) {
        throw new BadRequestException('Enter your current password to change your email');
      }
      if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    try {
      const updated = await this.prisma.user.update({ where: { id: userId }, data: changes });
      return toUserDto(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That email is already in use');
      }
      throw error;
    }
  }

  /**
   * Changes the password (or sets the first one on a Google-only account), signs out every
   * other session and issues fresh tokens.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    userAgent?: string,
  ): Promise<{ user: UserDto; tokens: IssuedTokens }> {
    const user = await this.findOrThrow(userId);
    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Enter your current password');
      }
      if (!(await this.passwords.verify(dto.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException('Choose a password different from the current one');
      }
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.tokens.revokeAllForUser(userId);
    const tokens = await this.tokens.issue(userId, userAgent);
    return { user: toUserDto(updated), tokens };
  }

  /** Permanently deletes the account and, via cascades, every record it owns. */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.findOrThrow(userId);
    // Accounts without a password rely on the typed "DELETE" confirmation alone.
    if (user.passwordHash) {
      if (!dto.password || !(await this.passwords.verify(dto.password, user.passwordHash))) {
        throw new UnauthorizedException('Password is incorrect');
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
