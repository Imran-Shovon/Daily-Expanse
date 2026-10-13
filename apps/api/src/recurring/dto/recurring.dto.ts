import {
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  TRANSACTION_TYPES,
  type PaymentMethod,
  type RecurrenceFrequency,
  type TransactionType,
} from '@expense/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsMoney,
  IsPlainDate,
  MoneyTransform,
  NormalizeTags,
  Trim,
} from '../../common/validation/validators';

export class CreateRecurringDto {
  @ApiProperty({ example: 'Netflix' })
  @Trim()
  @IsString()
  @Length(1, 120)
  title: string;

  @ApiProperty({ example: '15.99' })
  @MoneyTransform()
  @IsMoney()
  amount: string;

  @ApiProperty({ enum: TRANSACTION_TYPES })
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;

  @ApiProperty()
  @IsString()
  @Length(1, 40)
  categoryId: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'CASH' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  tags?: string[];

  @ApiProperty({ enum: RECURRENCE_FREQUENCIES })
  @IsIn(RECURRENCE_FREQUENCIES)
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 365, description: 'Every N periods' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;

  @ApiProperty({ example: '2026-10-01' })
  @IsPlainDate()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-10-01' })
  @IsOptional()
  @IsPlainDate()
  endDate?: string | null;
}

export class UpdateRecurringDto extends PartialType(CreateRecurringDto) {
  @ApiPropertyOptional({ description: 'Pause (false) or resume (true) the schedule' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
