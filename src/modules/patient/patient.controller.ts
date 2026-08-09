import {
  BadRequestException,
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
  Logger,
  Req,
} from '@nestjs/common';
import { AccountTypes, Public } from '../../common/decorators';
import { PatientService } from './patient.service';
import { PatientChartService } from './patient-chart.service';
import { InvoiceService } from '../invoice/invoice.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/create-patient.dto';
import { PatientChartQueryDto } from './dto/patient-chart-query.dto';
import { RegisteredTodayQueryDto } from './dto/registered-today-query.dto';
import {
  ForceCreateQueryDto,
  MergePatientsDto,
  SimilarMatchesBodyDto,
  SimilarMatchesQueryDto,
} from './dto/similar-matches.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Patient')
@Controller('patients')
export class PatientController {
  private readonly log = new Logger(PatientController.name);
  constructor(
    private readonly patientService: PatientService,
    private readonly patientChartService: PatientChartService,
    private readonly invoiceService: InvoiceService,
  ) {}

  private applySelect<T extends Record<string, unknown>>(
    payload: T,
    select?: string,
  ): Partial<T> | T {
    if (!select?.trim()) return payload;

    const fields = select
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    if (!fields.length) return payload;

    const allowedFields = Object.keys(payload);
    const invalidFields = fields.filter(
      (field) => !allowedFields.includes(field),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Invalid select field(s): ${invalidFields.join(', ')}.`,
      );
    }

    return fields.reduce((acc, field) => {
      acc[field as keyof T] = payload[field as keyof T];
      return acc;
    }, {} as Partial<T>);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new patient',
    description:
      'Returns 409 PATIENT_SIMILAR_MATCHES when name+DOB candidates exist unless forceCreate=true (query or body). Phone conflicts always 409.',
  })
  @ApiResponse({
    status: 201,
    description: 'Patient created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone conflict or similar patient matches',
  })
  create(
    @Body() createPatientDto: CreatePatientDto,
    @Query() forceQuery: ForceCreateQueryDto,
    @Req() req: any,
  ) {
    return this.patientService.create(createPatientDto, req, {
      forceCreate: forceQuery.forceCreate,
    });
  }

  @Get('similar-matches')
  @ApiOperation({
    summary: 'Find patients with similar name and same date of birth',
  })
  @ApiResponse({ status: 200, description: 'Matching patient candidates' })
  findSimilarMatchesGet(@Query() query: SimilarMatchesQueryDto) {
    return this.patientService.findSimilarMatches(query);
  }

  @Post('similar-matches')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find patients with similar name and same date of birth (body)',
  })
  @ApiResponse({ status: 200, description: 'Matching patient candidates' })
  findSimilarMatchesPost(@Body() body: SimilarMatchesBodyDto) {
    return this.patientService.findSimilarMatches(body);
  }

  @Post('merge')
  @AccountTypes('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Merge duplicate patient into survivor (SUPER_ADMIN)',
    description:
      'Reassigns all patient FK relations from duplicateId to survivorId, then deletes the duplicate. Survivor keeps phoneNumber and hospital patientId.',
  })
  @ApiResponse({ status: 200, description: 'Survivor patient after merge' })
  merge(@Body() body: MergePatientsDto, @Req() req: { user: { sub: string } }) {
    return this.patientService.mergePatients(
      body.survivorId,
      body.duplicateId,
      req.user.sub,
    );
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all patients with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of patients retrieved successfully',
  })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
    @Query('q') search: string = '',
    @Query('filterCategory') filterCategory: string = '',
    @Query('fromDate') fromDate: string = '',
    @Query('toDate') toDate: string = '',
    @Query('sortBy') sortBy: string = '',
    @Query('isAscending') isAscending: boolean = true,
    @Query('listStatusFilter') listStatusFilter?: string,
  ) {
    return this.patientService.findAll(
      parseInt(skip),
      parseInt(take),
      search,
      filterCategory,
      fromDate,
      toDate,
      sortBy,
      isAscending,
      listStatusFilter,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search patients by name, ID, email or phone' })
  @ApiResponse({ status: 200, description: 'Search results' })
  search(@Query('q') query: string) {
    return this.patientService.search(query);
  }

  @Get('registered/today')
  @AccountTypes('FRONTDESK', 'FRONT_DESK', 'MEDICAL_RECORDS')
  @ApiOperation({
    summary: 'Patients registered today (front desk & medical records)',
    description:
      'Lists all patients whose registration date (createdAt) falls on the current calendar day. Optional asOf anchor for testing or timezone-aligned "today".',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of patients registered today',
  })
  findRegisteredToday(@Query() query: RegisteredTodayQueryDto) {
    return this.patientService.findRegisteredToday(
      query.asOf,
      query.skip ?? 0,
      query.take ?? 50,
      query.q,
    );
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get complete patient medical history' })
  @ApiResponse({
    status: 200,
    description: 'Patient history retrieved',
  })
  getHistory(@Param('id') id: string) {
    return this.patientService.getPatientHistory(id);
  }

  @Get(':id/chart')
  @ApiOperation({
    summary: 'Patient chart (profile + summary; opt-in sections via include)',
  })
  @ApiResponse({ status: 200, description: 'Patient chart payload' })
  getChart(@Param('id') id: string, @Query() query: PatientChartQueryDto) {
    return this.patientChartService.getChart(id, query);
  }

  @Get(':id/consultation-credits')
  @ApiOperation({
    summary: 'List paid consultation credits (2 visits / 14 days per payment)',
  })
  @ApiResponse({ status: 200, description: 'Consultation credits for patient' })
  getConsultationCredits(@Param('id') id: string) {
    return this.invoiceService.listConsultationCredits(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({
    status: 200,
    description: 'Patient retrieved successfully',
  })
  async findOne(@Param('id') id: string, @Query('select') select?: string) {
    const patient = await this.patientService.findOne(id);
    if (!patient) {
      return patient;
    }
    return this.applySelect(patient as Record<string, unknown>, select);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient information' })
  @ApiResponse({
    status: 200,
    description: 'Patient updated successfully',
  })
  update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Req() req: any,
  ) {
    return this.patientService.update(id, updatePatientDto, req);
  }

  @Delete(':id')
  @AccountTypes('SUPER_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a patient' })
  @ApiResponse({
    status: 204,
    description: 'Patient deleted successfully',
  })
  remove(@Param('id') id: string) {
    return this.patientService.remove(id);
  }
}
