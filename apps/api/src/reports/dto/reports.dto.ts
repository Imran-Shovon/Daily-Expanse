import {
  PAYMENT_METHODS,
  REPORT_GRANULARITIES,
  TRANSACTION_TYPES,
  type PaymentMethod,
  type ReportGranularity,
  type TransactionType,
} from '@expense/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

export class TrendQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    enum: REPORT_GRANULARITIES,
    description: 'Bucket size. Chosen from the range length when omitted.',
  })
  @IsOptional()
  @IsIn(REPORT_GRANULARITIES)
  granularity?: ReportGranularity;
}

export class CategoryBreakdownQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: TRANSACTION_TYPES, default: 'EXPENSE' })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType = 'EXPENSE';
}

export class ExportQueryDto extends DateRangeQueryDto {
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
}
