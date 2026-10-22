import { LOAN_DIRECTIONS, type LoanDirection } from '@expense/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsMoney, IsPlainDate, MoneyTransform, Trim } from '../../common/validation/validators';

export class CreateLoanDto {
  @ApiPropertyOptional({
    enum: LOAN_DIRECTIONS,
    default: 'BORROWED',
    description: 'BORROWED: you owe them. LENT: they owe you. Cannot change later.',
  })
  @IsOptional()
  @IsIn(LOAN_DIRECTIONS)
  direction?: LoanDirection;

  @ApiProperty({ example: 'Rahim (brother)', description: 'Who you borrowed from or lent to' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  counterparty: string;

  @ApiProperty({ example: '5000.00' })
  @MoneyTransform()
  @IsMoney()
  amount: string;

  @ApiPropertyOptional({ example: '2026-10-19', description: 'Defaults to today' })
  @IsOptional()
  @IsPlainDate()
  loanDate?: string;

  @ApiPropertyOptional({ example: '2027-01-31' })
  @IsOptional()
  @IsPlainDate()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateLoanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  counterparty?: string;

  @ApiPropertyOptional({ description: 'Cannot be lower than the amount already repaid' })
  @IsOptional()
  @MoneyTransform()
  @IsMoney()
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPlainDate()
  loanDate?: string;

  @ApiPropertyOptional({ description: 'null removes the due date' })
  @IsOptional()
  @IsPlainDate()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateRepaymentDto {
  @ApiProperty({ example: '1000.00', description: 'Cannot exceed the outstanding amount' })
  @MoneyTransform()
  @IsMoney()
  amount: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Defaults to today' })
  @IsOptional()
  @IsPlainDate()
  paidOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateRepaymentDto {
  @ApiPropertyOptional({ example: '1500.00', description: 'Total repaid cannot exceed the loan' })
  @IsOptional()
  @MoneyTransform()
  @IsMoney()
  amount?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsPlainDate()
  paidOn?: string;

  @ApiPropertyOptional({ description: 'null or empty removes the note' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
