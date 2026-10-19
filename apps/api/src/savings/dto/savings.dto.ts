import { SAVINGS_ENTRY_TYPES, type SavingsEntryType } from '@expense/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { IsMoney, IsPlainDate, MoneyTransform, Trim } from '../../common/validation/validators';

export class CreateSavingsEntryDto {
  @ApiProperty({ enum: SAVINGS_ENTRY_TYPES, description: 'DEPOSIT adds, WITHDRAWAL takes out' })
  @IsIn(SAVINGS_ENTRY_TYPES)
  type: SavingsEntryType;

  @ApiProperty({ example: '2500.00', description: 'Withdrawals cannot exceed what is saved' })
  @MoneyTransform()
  @IsMoney()
  amount: string;

  @ApiPropertyOptional({ example: '2026-10-19', description: 'Defaults to today; not in future' })
  @IsOptional()
  @IsPlainDate()
  date?: string;

  @ApiPropertyOptional({ example: 'Salary', description: 'Required for deposits' })
  @ValidateIf((o: CreateSavingsEntryDto) => o.type === 'DEPOSIT')
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter the source of funds' })
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional({ example: 'Medical expenses', description: 'Required for withdrawals' })
  @ValidateIf((o: CreateSavingsEntryDto) => o.type === 'WITHDRAWAL')
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter the purpose' })
  @MaxLength(80)
  purpose?: string;

  @ApiPropertyOptional({ example: 'October salary' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SavingsEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SAVINGS_ENTRY_TYPES })
  @IsOptional()
  @IsIn(SAVINGS_ENTRY_TYPES)
  type?: SavingsEntryType;
}
