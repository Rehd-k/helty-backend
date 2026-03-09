import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabCategoryService } from './lab-category.service';
import { CreateLabCategoryDto } from './dto/create-lab-category.dto';

@ApiTags('Lab – Categories')
@Controller('lab/categories')
export class LabCategoryController {
  constructor(private readonly labCategoryService: LabCategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lab category' })
  create(@Body() dto: CreateLabCategoryDto) {
    return this.labCategoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List lab categories' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.labCategoryService.findAll(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab category by ID' })
  findOne(@Param('id') id: string) {
    return this.labCategoryService.findOne(id);
  }
}
