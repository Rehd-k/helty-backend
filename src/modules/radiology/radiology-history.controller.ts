import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { RadiologyHistoryService } from './radiology-history.service';

@ApiTags('Radiology – History')
@Controller('radiology')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RadiologyHistoryController {
  constructor(
    private readonly radiologyHistoryService: RadiologyHistoryService,
  ) {}

  @Get('patients/:patientId/radiology-history')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get complete imaging history for a patient' })
  getPatientHistory(@Param('patientId') patientId: string) {
    return this.radiologyHistoryService.getPatientRadiologyHistory(patientId);
  }
}
