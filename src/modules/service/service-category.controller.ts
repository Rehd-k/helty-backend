import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ServiceCategoryService } from './service-category.service';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from './dto/create-service-category.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('ServiceCategory')
@Controller('service-categories')
export class ServiceCategoryController {
  constructor(private readonly serviceCategoryService: ServiceCategoryService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new service category' })
  create(@Body() dto: CreateServiceCategoryDto, @Req() req: any) {
    return this.serviceCategoryService.create(dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all service categories' })
  findAll() {
    return this.serviceCategoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service category by ID' })
  findOne(@Param('id') id: string) {
    return this.serviceCategoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service category' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceCategoryDto) {
    return this.serviceCategoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service category' })
  remove(@Param('id') id: string) {
    return this.serviceCategoryService.remove(id);
  }
}
