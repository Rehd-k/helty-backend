import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';

@ApiTags('Services')
@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new hospital service',
    description:
      'Creates a hospital service (e.g. Blood Test, X-Ray). Optionally links it to a category and department. The authenticated staff member is recorded as `createdBy`.',
  })
  @ApiCreatedResponse({ description: 'Service created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error in request body' })
  create(@Body() dto: CreateServiceDto, @Req() req: any) {
    console.log('Creating service with DTO:', dto);
    return this.serviceService.create(dto, req);
  }

  @Get()
  @ApiOperation({
    summary: 'List all hospital services (paginated)',
    description:
      'Returns a paginated list of all services ordered by name, with category and department info.',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Records to skip',
    example: 0,
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Records to return',
    example: 10,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search query',
    example: 'Blood Test',
  })
  @ApiQuery({
    name: 'filterCategory',
    required: false,
    type: String,
    description: 'Category filter',
    example: 'Lab Tests',
  })
  @ApiOkResponse({ description: 'Paginated list of services' })
  findAll(
    @Query('skip') skip = '0',
    @Query('take') take = '10',
    @Query('search') search: string = '',
    @Query('filterCategory') filterCategory: string = '',
    @Query('departmentId') departmentId: string = '',
    @Query('categoryId') categoryId: string = '',
  ) {
    return this.serviceService.findAll(
      +skip,
      +take,
      search,
      filterCategory,
      departmentId,
      categoryId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single service by ID',
    description:
      'Returns full service details including category, department, and related invoice items.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiOkResponse({ description: 'Service found' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a service',
    description:
      'Updates name, description, cost, category, or department. The authenticated staff member is recorded as `updatedBy`.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiOkResponse({ description: 'Service updated' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @Req() req: any,
  ) {
    return this.serviceService.update(id, dto, req);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a service',
    description:
      'Permanently deletes a service. **Fails** if the service is referenced by any invoice items.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiNoContentResponse({ description: 'Service deleted' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  @ApiBadRequestResponse({
    description: 'Service is still referenced by invoice items',
  })
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}
