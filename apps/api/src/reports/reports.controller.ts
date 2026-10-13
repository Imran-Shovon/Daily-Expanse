import type { IncomeExpenseReport, TransactionReport } from '@expense/shared';
import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserId } from '../common/auth/decorators';
import { AnalyticsService } from './analytics.service';
import { ExportQueryDto, TrendQueryDto } from './dto/reports.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('transactions')
  @ApiOperation({
    summary: 'Daily / weekly / monthly / annual expense report with largest transactions',
  })
  transactions(
    @CurrentUserId() userId: string,
    @Query() query: TrendQueryDto,
  ): Promise<TransactionReport> {
    return this.analytics.transactionReport(userId, query);
  }

  @Get('income-expenses')
  @ApiOperation({
    summary: 'Income versus expenses with savings rate and cumulative savings trend',
  })
  incomeExpenses(
    @CurrentUserId() userId: string,
    @Query() query: TrendQueryDto,
  ): Promise<IncomeExpenseReport> {
    return this.analytics.incomeVsExpenses(userId, query);
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Download transactions in the range as CSV' })
  async export(
    @CurrentUserId() userId: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const { filename, csv } = await this.analytics.exportCsv(userId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    // UTF-8 BOM so spreadsheet apps detect the encoding.
    return `\uFEFF${csv}`;
  }
}
