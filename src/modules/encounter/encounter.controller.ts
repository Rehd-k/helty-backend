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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { EncounterService } from './encounter.service';
import {
  CreateEncounterDto,
  StartOutpatientEncounterDto,
  UpdateEncounterDto,
  QueryEncounterDto,
} from './dto/create-encounter.dto';
import {
  CreateEncounterDiagnosisDto,
  UpdateEncounterDiagnosisDto,
} from './dto/encounter-diagnosis.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Encounter')
@Controller('encounters')
export class EncounterController {
  constructor(private readonly encounterService: EncounterService) { }

  @Post()
  @ApiOperation({
    summary: 'Create a new encounter',
    description:
      'If the patient already has an ongoing encounter of the same type (and admission, if any), that encounter is returned (200) instead of creating another. Consultation invoice lines are settled when the encounter is completed.',
  })
  async create(
    @Body() createEncounterDto: CreateEncounterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { encounter, reused } = await this.encounterService.create(
      createEncounterDto,
      req,
    );
    res.status(reused ? HttpStatus.OK : HttpStatus.CREATED);
    return encounter;
  }

  @Post('start-outpatient')
  @ApiOperation({
    summary: 'Start an outpatient encounter (e.g. when doctor begins consult)',
    description:
      'If the patient already has an ongoing outpatient encounter, it is returned (200). Otherwise a new encounter is created (201). Consultation lines settle on encounter completion.',
  })
  async startOutpatient(
    @Body() dto: StartOutpatientEncounterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { encounter, reused } = await this.encounterService.startOutpatient(
      dto,
    );
    res.status(reused ? HttpStatus.OK : HttpStatus.CREATED);
    return encounter;
  }

  @Get()
  @ApiOperation({ summary: 'Get all encounters with optional filters' })
  findAll(@Query() query: QueryEncounterDto) {
    return this.encounterService.findAll(query);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all encounters for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.encounterService.findByPatientId(patientId);
  }

  @Post(':encounterId/diagnoses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a diagnosis to an encounter' })
  addDiagnosis(
    @Param('encounterId') encounterId: string,
    @Body() dto: CreateEncounterDiagnosisDto,
  ) {
    return this.encounterService.addDiagnosis(encounterId, dto);
  }

  @Get(':encounterId/diagnoses')
  @ApiOperation({ summary: 'Get all diagnoses for an encounter' })
  getDiagnoses(@Param('encounterId') encounterId: string) {
    return this.encounterService.getDiagnoses(encounterId);
  }

  @Patch(':encounterId/diagnoses/:diagnosisId')
  @ApiOperation({ summary: 'Update an encounter diagnosis' })
  updateDiagnosis(
    @Param('encounterId') encounterId: string,
    @Param('diagnosisId') diagnosisId: string,
    @Body() dto: UpdateEncounterDiagnosisDto,
  ) {
    return this.encounterService.updateDiagnosis(encounterId, diagnosisId, dto);
  }

  @Delete(':encounterId/diagnoses/:diagnosisId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a diagnosis from an encounter' })
  removeDiagnosis(
    @Param('encounterId') encounterId: string,
    @Param('diagnosisId') diagnosisId: string,
  ) {
    return this.encounterService.removeDiagnosis(encounterId, diagnosisId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get encounter by ID',
    description:
      'Optional query: expand=medicationOrders,labOrders,appointment (or * for all)',
  })
  findOne(@Param('id') id: string, @Query('expand') expand?: string) {
    return this.encounterService.findOne(id, expand);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update encounter' })
  update(
    @Param('id') id: string,
    @Body() updateEncounterDto: any,
  ) {
    console.log(updateEncounterDto);
    return this.encounterService.update(id, updateEncounterDto);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark encounter as completed (sets endTime and status)',
    description:
      'For outpatient encounters, consultation invoice lines linked to this encounter are marked settled.',
  })
  complete(@Param('id') id: string, @Body() body: { updatedById?: string }) {
    return this.encounterService.complete(id, body?.updatedById);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete encounter' })
  remove(@Param('id') id: string) {
    return this.encounterService.remove(id);
  }
}
