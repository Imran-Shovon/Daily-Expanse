import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringController } from './recurring.controller';
import { RecurringScheduler } from './recurring.scheduler';
import { RecurringService } from './recurring.service';

@Module({
  imports: [CategoriesModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringScheduler],
  exports: [RecurringService],
})
export class RecurringTransactionsModule {}
