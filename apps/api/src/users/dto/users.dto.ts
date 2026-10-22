import {
  CURRENCIES,
  DATE_FORMATS,
  DATE_RANGE_PRESETS,
  THEMES,
  type DateFormat,
  type DateRangePreset,
  type Theme,
} from '@expense/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsTimeZone, ToLowerCase, Trim } from '../../common/validation/validators';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/auth.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alex Morgan' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ example: 'alex@example.com' })
  @IsOptional()
  @ToLowerCase()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: 'Required when changing the email address' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional({ enum: CURRENCIES })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: DATE_FORMATS })
  @IsOptional()
  @IsIn(DATE_FORMATS)
  dateFormat?: DateFormat;

  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;

  @ApiPropertyOptional({ enum: DATE_RANGE_PRESETS.filter((p) => p !== 'custom') })
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS.filter((p) => p !== 'custom'))
  defaultDateRange?: DateRangePreset;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Required unless the account has no password yet' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Required unless the account has no password' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;

  @ApiProperty({ example: 'DELETE', description: 'Must be exactly "DELETE"' })
  @Equals('DELETE', { message: 'Type DELETE to confirm' })
  confirmation: string;
}
