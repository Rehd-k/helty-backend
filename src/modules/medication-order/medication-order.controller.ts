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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { MedicationOrderService } from './medication-order.service';
import {
  CreateMedicationOrderDto,
  UpdateMedicationOrderDto,
} from './dto/create-medication-order.dto';
import { BeyondDurationConsentDto } from './dto/beyond-duration-consent.dto';

const DOCTOR_CONSENT_ACCESS = [
  'INPATIENT_DOCTOR',
  'CONSULTANT',
  'CMD',
  'SUPER_ADMIN',
] as const;

@ApiTags('Medication Order')
@Controller('medication-orders')
export class MedicationOrderController {
  constructor(
    private readonly medicationOrderService: MedicationOrderService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new medication order',
    description:
      'Creates a clinical medication order with status Prescribed. Inpatients: no invoice line until pharmacy bills nurse medication requests. Outpatients (ward OPD, no active admission): include requestedQuantity to create a medication request immediately.',
  })
  @ApiResponse({ status: 201, description: 'Medication order created.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or validation failed.',
  })
  @ApiResponse({ status: 404, description: 'Encounter or drug not found.' })
  create(
    @Body() dto: CreateMedicationOrderDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.medicationOrderService.create(dto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List medication orders with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of medication orders.',
  })
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
    @Query('encounterId') encounterId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ) {
    return this.medicationOrderService.findAll(
      skip,
      take,
      encounterId,
      patientId,
      status,
    );
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all medication orders for an encounter' })
  @ApiResponse({ status: 200, description: 'List of medication orders.' })
  @ApiResponse({ status: 404, description: 'Encounter not found.' })
  findByEncounterId(@Param('encounterId', ParseUUIDPipe) encounterId: string) {
    return this.medicationOrderService.findByEncounterId(encounterId);
  }

  @Get(':id/dose-schedule')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @ApiBearerAuth()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get dose schedule for a medication order' })
  getDoseSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationOrderService.getDoseSchedule(id);
  }

  @Post(':id/beyond-duration-consent')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AccessGuard)
  @ApiBearerAuth()
  @AccountTypes(...DOCTOR_CONSENT_ACCESS)
  @ApiOperation({
    summary: 'Authorize administration beyond prescribed course duration',
  })
  beyondDurationConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BeyondDurationConsentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.medicationOrderService.recordBeyondDurationConsent(
      id,
      req.user.sub,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medication order by ID' })
  @ApiResponse({ status: 200, description: 'Medication order details.' })
  @ApiResponse({ status: 404, description: 'Medication order not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationOrderService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update medication order',
    description:
      'Update status, dosing fields, or replace the drug. `billingQuantity` syncs the linked invoice line on pending orders. Setting `status` to `Cancelled` removes the unsettled invoice line and keeps the order for audit.',
  })
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
  @ApiOperation({
    summary: 'Delete medication order',
    description:
      'Deletes a pending order and removes its linked unsettled invoice line. Blocked for dispensed orders or orders with administration records.',
  })
  @ApiResponse({ status: 204, description: 'Medication order deleted.' })
  @ApiResponse({ status: 404, description: 'Medication order not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationOrderService.remove(id);
  }
}
