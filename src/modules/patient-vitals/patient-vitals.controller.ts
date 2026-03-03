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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PatientVitalsService } from './patient-vitals.service';
import {
  CreatePatientVitalsDto,
  QueryPatientVitalsDto,
  UpdatePatientVitalsDto,
} from './dto/patient-vitals.dto';

@ApiTags('Patient Vitals')
@Controller('patient-vitals')
export class PatientVitalsController {
  constructor(
    private readonly patientVitalsService: PatientVitalsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new set of vitals for a patient' })
  create(@Body() dto: CreatePatientVitalsDto) {
    return this.patientVitalsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List vitals records with optional patient filter and pagination',
  })
  findAll(@Query() query: QueryPatientVitalsDto) {
    return this.patientVitalsService.findAll(query);
  }

  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'List all vitals records for a specific patient',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.patientVitalsService.findByPatient(patientId);
  }

  @Get('patient/:patientId/latest')
  @ApiOperation({
    summary: 'Get the latest vitals record for a specific patient',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  findLatestByPatient(@Param('patientId') patientId: string) {
    return this.patientVitalsService.findLatestByPatient(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single vitals record by ID' })
  @ApiParam({ name: 'id', description: 'Vitals record UUID' })
  findOne(@Param('id') id: string) {
    return this.patientVitalsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing vitals record' })
  @ApiParam({ name: 'id', description: 'Vitals record UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientVitalsDto,
  ) {
    return this.patientVitalsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vitals record' })
  @ApiParam({ name: 'id', description: 'Vitals record UUID' })
  async remove(@Param('id') id: string) {
    await this.patientVitalsService.remove(id);
  }
}

