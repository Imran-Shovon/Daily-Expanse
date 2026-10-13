import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../common/auth/decorators';
import type { AppConfig } from '../config/configuration';
import { RecurringService } from './recurring.service';

/**
 * Entry point for an external scheduler (Vercel Cron) on serverless hosts, where the
 * in-process @Cron scheduler cannot run. Processing is idempotent, so extra calls are safe.
 */
@ApiExcludeController()
@Controller('internal/cron')
export class RecurringCronController {
  constructor(
    private readonly recurring: RecurringService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @SkipThrottle()
  @Get('recurring')
  async run(@Headers('authorization') authorization?: string) {
    const secret = this.config.get('CRON_SECRET', { infer: true });
    if (!secret) throw new NotFoundException();
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(authorization ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
    return this.recurring.processAllDue();
  }
}
