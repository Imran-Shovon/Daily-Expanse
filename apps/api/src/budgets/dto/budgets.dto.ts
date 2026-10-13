import { BUDGET_PERIODS, type BudgetPeriod } from '@expense/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsMoney, IsPlainDate, MoneyTransform, Trim } from '../../common/validation/validators';

export class CreateBudgetDto {
  @ApiPropertyOptional({ example: 'Monthly spending' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiProperty({ example: '1500.00' })
  @MoneyTransform()
  @IsMoney()
  amount: string;

  @ApiPropertyOptional({ enum: BUDGET_PERIODS, default: 'MONTHLY' })
  @IsOptional()
  @IsIn(BUDGET_PERIODS)
  period?: BudgetPeriod;

  @ApiPropertyOptional({ description: 'Expense category; omit or null for an overall budget' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  categoryId?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Periods are anchored to this date. Defaults to the start of the current period.',
  })
  @IsOptional()
  @IsPlainDate()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-09-30' })
  @IsOptional()
  @IsPlainDate()
  endDate?: string | null;
}

export class UpdateBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiPropertyOptional({ example: '1500.00' })
  @IsOptional()
  @MoneyTransform()
  @IsMoney()
  amount?: string;

  @ApiPropertyOptional({ enum: BUDGET_PERIODS })
  @IsOptional()
  @IsIn(BUDGET_PERIODS)
  period?: BudgetPeriod;

  @ApiPropertyOptional({ description: 'null switches to an overall budget' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPlainDate()
  startDate?: string;

  @ApiPropertyOptional({ description: 'null removes the end date' })
  @IsOptional()
  @IsPlainDate()
  endDate?: string | null;
}

export class BudgetsQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-13',
    description: 'Date used to pick each budget period. Defaults to today in the user time zone.',
  })
  @IsOptional()
  @IsPlainDate()
  date?: string;
}
