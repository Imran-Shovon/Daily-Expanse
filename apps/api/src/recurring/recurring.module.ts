import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringCronController } from './recurring-cron.controller';
import { RecurringController } from './recurring.controller';
import { RecurringScheduler } from './recurring.scheduler';
import { RecurringService } from './recurring.service';

@Module({
  imports: [CategoriesModule],
  controllers: [RecurringController, RecurringCronController],
  providers: [RecurringService, RecurringScheduler],
  exports: [RecurringService],
})
export class RecurringTransactionsModule {}
