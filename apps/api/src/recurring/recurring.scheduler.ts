import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AppConfig } from '../config/configuration';
import { RecurringService } from './recurring.service';

/**
 * Runs due recurring transactions every 10 minutes and once shortly after startup.
 * Safe to run on several instances at once: processing is idempotent (see RecurringService).
 */
@Injectable()
export class RecurringScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecurringScheduler.name);
  private running = false;

  constructor(
    private readonly recurring: RecurringService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get enabled() {
    return this.config.get('RECURRING_SCHEDULER_ENABLED', { infer: true });
  }

  onApplicationBootstrap() {
    if (this.enabled) setTimeout(() => void this.run(), 5_000).unref();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      const { schedules, created } = await this.recurring.processAllDue();
      if (schedules > 0) {
        this.logger.log(
          `Processed ${schedules} due schedule(s), created ${created} transaction(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Recurring transaction run failed', (error as Error).stack);
    } finally {
      this.running = false;
    }
  }
}
