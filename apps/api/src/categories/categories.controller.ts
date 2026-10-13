import type { Category } from '@expense/shared';
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
import { ApiBearerAuth, ApiConflictResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/auth/decorators';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  DeleteCategoryQueryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories with usage counts' })
  list(
    @CurrentUserId() userId: string,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<Category[]> {
    return this.categories.list(userId, query.type);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom category' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categories.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or restyle a category' })
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categories.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category, optionally moving its transactions to another' })
  @ApiConflictResponse({ description: 'Category is in use and no reassignTo was given' })
  remove(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query() query: DeleteCategoryQueryDto,
  ): Promise<void> {
    return this.categories.remove(userId, id, query.reassignTo);
  }
}
