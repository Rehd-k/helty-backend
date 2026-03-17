import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyHistoryService } from './radiology-history.service';

@ApiTags('Radiology – History')
@Controller('radiology')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(
  'CONSULTANT',
  'INPATIENT_DOCTOR',
  'RADIOLOGIST',
  'RADIOGRAPHER',
  'RADIOLOGY_RECEPTIONIST',
  'RADIOLOGY',
)
export class RadiologyHistoryController {
  constructor(
    private readonly radiologyHistoryService: RadiologyHistoryService,
  ) {}

  @Get('patients/:patientId/radiology-history')
  @ApiOperation({ summary: 'Get complete imaging history for a patient' })
  getPatientHistory(@Param('patientId') patientId: string) {
    return this.radiologyHistoryService.getPatientRadiologyHistory(patientId);
  }
}
