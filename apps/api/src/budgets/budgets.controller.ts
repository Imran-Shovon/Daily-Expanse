import type { Budget } from '@expense/shared';
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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/auth/decorators';
import { BudgetsService } from './budgets.service';
import { BudgetsQueryDto, CreateBudgetDto, UpdateBudgetDto } from './dto/budgets.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List budgets with spending for the period containing `date`' })
  list(@CurrentUserId() userId: string, @Query() query: BudgetsQueryDto): Promise<Budget[]> {
    return this.budgets.list(userId, query.date);
  }

  @Post()
  @ApiOperation({ summary: 'Create an overall or category budget' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateBudgetDto): Promise<Budget> {
    return this.budgets.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a budget' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<Budget> {
    return this.budgets.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    return this.budgets.remove(userId, id);
  }
}
