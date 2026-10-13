import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringTransactionsModule } from '../recurring/recurring.module';
import { AnalyticsService } from './analytics.service';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';

@Module({
  imports: [BudgetsModule, RecurringTransactionsModule],
  controllers: [DashboardController, ReportsController],
  providers: [AnalyticsService],
})
export class ReportsModule {}
