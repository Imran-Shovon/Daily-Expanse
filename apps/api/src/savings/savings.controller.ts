import type { Paginated, SavingsEntry, SavingsSummary } from '@expense/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/auth/decorators';
import { CreateSavingsEntryDto, SavingsEntriesQueryDto } from './dto/savings.dto';
import { SavingsService } from './savings.service';

@ApiTags('savings')
@ApiBearerAuth()
@Controller('savings')
export class SavingsController {
  constructor(private readonly savings: SavingsService) {}

  @Get()
  @ApiOperation({ summary: 'Savings balance with all-time and this-month totals' })
  summary(@CurrentUserId() userId: string): Promise<SavingsSummary> {
    return this.savings.summary(userId);
  }

  @Get('entries')
  @ApiOperation({ summary: 'Savings history, newest first, with the balance after each entry' })
  entries(
    @CurrentUserId() userId: string,
    @Query() query: SavingsEntriesQueryDto,
  ): Promise<Paginated<SavingsEntry>> {
    return this.savings.entries(userId, query);
  }

  @Post('entries')
  @ApiOperation({ summary: 'Add money to savings or take money out' })
  add(@CurrentUserId() userId: string, @Body() dto: CreateSavingsEntryDto): Promise<SavingsEntry> {
    return this.savings.addEntry(userId, dto);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an entry from the history' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    return this.savings.removeEntry(userId, id);
  }
}
