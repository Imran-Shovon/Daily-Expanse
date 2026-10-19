import type { Loan, LoansOverview } from '@expense/shared';
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
import { CurrentUserId } from '../common/auth/decorators';
import { CreateLoanDto, CreateRepaymentDto, UpdateLoanDto } from './dto/loans.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @ApiOperation({ summary: 'List borrowed loans with repayments and outstanding totals' })
  overview(@CurrentUserId() userId: string): Promise<LoansOverview> {
    return this.loans.overview(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Record money you borrowed' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateLoanDto): Promise<Loan> {
    return this.loans.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a loan' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLoanDto,
  ): Promise<Loan> {
    return this.loans.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a loan and its repayment history' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    return this.loans.remove(userId, id);
  }

  @Post(':id/repayments')
  @ApiOperation({ summary: 'Record a repayment (cannot exceed the outstanding amount)' })
  repay(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateRepaymentDto,
  ): Promise<Loan> {
    return this.loans.addRepayment(userId, id, dto);
  }

  @Delete(':id/repayments/:repaymentId')
  @ApiOperation({ summary: 'Undo a repayment' })
  removeRepayment(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('repaymentId') repaymentId: string,
  ): Promise<Loan> {
    return this.loans.removeRepayment(userId, id, repaymentId);
  }
}
