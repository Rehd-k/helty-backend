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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MedicationRequestService } from './medication-request.service';
import {
  BillMedicationRequestsDto,
  CreateMedicationRequestDto,
  ListMedicationRequestsQueryDto,
  UpdateMedicationRequestDto,
} from './dto/create-medication-request.dto';

@ApiTags('Medication Request')
@Controller('medication-requests')
export class MedicationRequestController {
  constructor(
    private readonly medicationRequestService: MedicationRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Nurse requests medication with billing quantity',
    description:
      'Creates a medication request from a prescribed order. Does not create an invoice line until pharmacy bills.',
  })
  @ApiResponse({ status: 201, description: 'Medication request created.' })
  create(@Body() dto: CreateMedicationRequestDto) {
    return this.medicationRequestService.create(dto);
  }

  @Post('bill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pharmacy bills medication requests to encounter invoice',
    description:
      'Creates or updates the encounter invoice with drug lines for each REQUESTED medication request.',
  })
  @ApiResponse({ status: 200, description: 'Requests billed successfully.' })
  bill(@Body() dto: BillMedicationRequestsDto) {
    return this.medicationRequestService.bill(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List medication requests with optional filters',
    description:
      'Use status=REQUESTED for the pharmacy queue. Also available at GET /pharmacy/medication-requests.',
  })
  findAll(@Query() query: ListMedicationRequestsQueryDto) {
    return this.medicationRequestService.findAll(query);
  }

  @Get('encounter/:encounterId')
  @ApiOperation({ summary: 'Get all medication requests for an encounter' })
  findByEncounterId(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
  ) {
    return this.medicationRequestService.findByEncounterId(encounterId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medication request by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationRequestService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a medication request',
    description:
      'Pharmacy may update REQUESTED requests (quantity, notes, drug substitution). ' +
      'The prescribing doctor may also update or cancel their own requests while unpaid and unsettled, including after billing. ' +
      'Requires modifiedByStaffId. Drug substitution by pharmacy sets substitutedByPharmacist on the linked order; the prescribing doctor name is never changed.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationRequestDto,
  ) {
    return this.medicationRequestService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a medication request',
    description:
      'REQUESTED: prescribing doctor, requesting nurse, or pharmacy may cancel. ' +
      'BILLED (unpaid, unsettled): only the prescribing doctor may cancel and the invoice line is removed.',
  })
  @ApiQuery({
    name: 'cancelledByStaffId',
    required: true,
    description: 'Staff UUID performing the cancellation',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cancelledByStaffId', ParseUUIDPipe) cancelledByStaffId: string,
  ) {
    return this.medicationRequestService.remove(id, cancelledByStaffId);
  }
}
