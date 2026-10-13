import type { Paginated, Transaction } from '@expense/shared';
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
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './dto/transactions.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Search, filter, sort and paginate transactions' })
  list(
    @CurrentUserId() userId: string,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<Paginated<Transaction>> {
    return this.transactions.list(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a transaction' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateTransactionDto): Promise<Transaction> {
    return this.transactions.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one transaction' })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string): Promise<Transaction> {
    return this.transactions.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactions.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    return this.transactions.remove(userId, id);
  }
}
