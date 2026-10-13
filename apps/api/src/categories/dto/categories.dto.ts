import { CATEGORY_ICONS, TRANSACTION_TYPES, type TransactionType } from '@expense/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Trim } from '../../common/validation/validators';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class CreateCategoryDto {
  @ApiProperty({ example: 'Coffee' })
  @Trim()
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({ enum: TRANSACTION_TYPES })
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;

  @ApiProperty({ example: '#16a34a' })
  @Matches(HEX_COLOR, { message: 'color must be a hex color like #16a34a' })
  color: string;

  @ApiProperty({ enum: CATEGORY_ICONS, example: 'coffee' })
  @IsIn(CATEGORY_ICONS)
  icon: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;
}

export class DeleteCategoryQueryDto {
  @ApiPropertyOptional({
    description:
      'Category that existing transactions and recurring schedules are moved to. Required when the category is in use.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  reassignTo?: string;
}
