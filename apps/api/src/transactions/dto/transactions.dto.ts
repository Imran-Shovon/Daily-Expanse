import {
  DATE_RANGE_PRESETS,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type DateRangePreset,
  type PaymentMethod,
  type TransactionType,
} from '@expense/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  IsMoney,
  IsPlainDate,
  MoneyTransform,
  NormalizeTags,
  Trim,
} from '../../common/validation/validators';

export class CreateTransactionDto {
  @ApiProperty({ example: 'Weekly groceries' })
  @Trim()
  @IsString()
  @Length(1, 120)
  title: string;

  @ApiProperty({ example: '84.20', description: 'Positive decimal string with up to 2 decimals' })
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

  @ApiProperty({ example: '2026-10-13' })
  @IsPlainDate()
  date: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, default: 'CASH' })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['family', 'weekly'] })
  @IsOptional()
  @NormalizeTags()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  tags?: string[];
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}

export const TRANSACTION_SORT_FIELDS = ['date', 'amount', 'title', 'createdAt'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export class ListTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches title or notes (case-insensitive)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 40)
  categoryId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Only transactions carrying this tag' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  tag?: string;

  @ApiPropertyOptional({ enum: DATE_RANGE_PRESETS })
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS)
  range?: DateRangePreset;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsPlainDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsPlainDate()
  to?: string;

  @ApiPropertyOptional({ enum: TRANSACTION_SORT_FIELDS, default: 'date' })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  sortBy: TransactionSortField = 'date';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
