import type { CategoryBreakdown, DashboardSummary, SpendingTrends } from '@expense/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/auth/decorators';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { AnalyticsService } from './analytics.service';
import { CategoryBreakdownQueryDto, TrendQueryDto } from './dto/reports.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Income, expenses, net, savings rate, budget status and recent activity',
  })
  summary(
    @CurrentUserId() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<DashboardSummary> {
    return this.analytics.summary(userId, query);
  }

  @Get('spending-trends')
  @ApiOperation({ summary: 'Income and expenses bucketed by day, week, month or year' })
  trends(@CurrentUserId() userId: string, @Query() query: TrendQueryDto): Promise<SpendingTrends> {
    return this.analytics.spendingTrends(userId, query);
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Totals per category for income or expenses' })
  breakdown(
    @CurrentUserId() userId: string,
    @Query() query: CategoryBreakdownQueryDto,
  ): Promise<CategoryBreakdown> {
    return this.analytics.categoryBreakdown(userId, query);
  }
}
