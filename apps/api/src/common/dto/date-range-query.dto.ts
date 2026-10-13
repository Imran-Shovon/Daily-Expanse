import { DATE_RANGE_PRESETS, type DateRangePreset } from '@expense/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsPlainDate } from '../validation/validators';

export class DateRangeQueryDto {
  @ApiPropertyOptional({
    enum: DATE_RANGE_PRESETS,
    description:
      'Preset range in the user time zone. Defaults to the user preference, or "custom" when from/to are given.',
  })
  @IsOptional()
  @IsIn(DATE_RANGE_PRESETS)
  range?: DateRangePreset;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Inclusive start date for a custom range',
  })
  @IsOptional()
  @IsPlainDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Inclusive end date for a custom range',
  })
  @IsOptional()
  @IsPlainDate()
  to?: string;
}
