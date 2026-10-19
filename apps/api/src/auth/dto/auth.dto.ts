import { CURRENCIES } from '@expense/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE = 'Password must contain at least one letter and one number';

export class RegisterDto {
  @ApiProperty({ example: 'Alex Morgan' })
  @Trim()
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ example: 'alex@example.com' })
  @ToLowerCase()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Sup3rSecret!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiPropertyOptional({ example: 'BDT', enum: CURRENCIES, default: 'BDT' })
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({
    example: 'Asia/Dhaka',
    description: 'IANA time zone, usually from the browser',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'demo@example.com' })
  @ToLowerCase()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Demo1234' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'alex@example.com' })
  @ToLowerCase()
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Length(20, 200)
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}
