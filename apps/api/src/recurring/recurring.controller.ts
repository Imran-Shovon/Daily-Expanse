import type { RecurringExecution, RecurringTransaction } from '@expense/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserId } from '../common/auth/decorators';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';
import { RecurringService } from './recurring.service';

@ApiTags('recurring-transactions')
@ApiBearerAuth()
@Controller('recurring-transactions')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  @ApiOperation({ summary: 'List recurring transaction schedules' })
  list(@CurrentUserId() userId: string): Promise<RecurringTransaction[]> {
    return this.recurring.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a schedule; occurrences already due are generated immediately' })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateRecurringDto,
  ): Promise<RecurringTransaction> {
    return this.recurring.create(userId, dto);
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate any due occurrences for the current user now' })
  process(@CurrentUserId() userId: string): Promise<{ created: number }> {
    return this.recurring.processDueForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one schedule' })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string): Promise<RecurringTransaction> {
    return this.recurring.findOne(userId, id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Execution history (latest 100)' })
  executions(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<RecurringExecution[]> {
    return this.recurring.executions(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule (also accepts isActive to pause/resume)' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ): Promise<RecurringTransaction> {
    return this.recurring.update(userId, id, dto);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a schedule' })
  pause(@CurrentUserId() userId: string, @Param('id') id: string): Promise<RecurringTransaction> {
    return this.recurring.pause(userId, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a schedule; occurrences missed while paused are skipped' })
  resume(@CurrentUserId() userId: string, @Param('id') id: string): Promise<RecurringTransaction> {
    return this.recurring.resume(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule (generated transactions are kept)' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    return this.recurring.remove(userId, id);
  }
}
