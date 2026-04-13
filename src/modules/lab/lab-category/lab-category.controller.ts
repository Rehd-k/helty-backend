import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabCategoryService } from './lab-category.service';
import { CreateLabCategoryDto } from './dto/create-lab-category.dto';
import { UpdateLabCategoryDto } from './dto/update-lab-category.dto';

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
  findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lab category' })
  update(@Param('id') id: string, @Body() dto: UpdateLabCategoryDto) {
    return this.labCategoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lab category' })
  remove(@Param('id') id: string) {
    return this.labCategoryService.remove(id);
  }
}
