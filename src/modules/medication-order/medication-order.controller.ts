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
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MedicationOrderService } from './medication-order.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';

@ApiTags('Medication Order')
@Controller('medication-orders')
export class MedicationOrderController {
  constructor(private readonly medicationOrderService: MedicationOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new medication order' })
  @ApiResponse({ status: 201, description: 'Medication order created.' })
  @ApiResponse({ status: 400, description: 'Invalid input or validation failed.' })
  @ApiResponse({ status: 404, description: 'Encounter or drug not found.' })
  create(@Body() dto: CreateMedicationOrderDto) {
    return this.medicationOrderService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List medication orders with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of medication orders.' })
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: string,
  ) {
    return this.medicationOrderService.findAll(skip, take, encounterId, status);
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all medication orders for an encounter' })
  @ApiResponse({ status: 200, description: 'List of medication orders.' })
  @ApiResponse({ status: 404, description: 'Encounter not found.' })
  findByEncounterId(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
  ) {
    return this.medicationOrderService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medication order by ID' })
  @ApiResponse({ status: 200, description: 'Medication order details.' })
  @ApiResponse({ status: 404, description: 'Medication order not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationOrderService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update medication order' })
  @ApiResponse({ status: 200, description: 'Medication order updated.' })
  @ApiResponse({ status: 404, description: 'Medication order not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationOrderDto,
  ) {
    return this.medicationOrderService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete medication order' })
  @ApiResponse({ status: 204, description: 'Medication order deleted.' })
  @ApiResponse({ status: 404, description: 'Medication order not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationOrderService.remove(id);
  }
}
