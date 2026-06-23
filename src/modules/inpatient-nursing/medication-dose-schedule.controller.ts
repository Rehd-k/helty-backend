import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { INPATIENT_NURSING_READ_ACCESS } from '../nursing/nursing.constants';
import { MedicationScheduleService } from '../medication-schedule/medication-schedule.service';

@ApiTags('Inpatient — medication dose schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/medication-dose-schedules')
export class MedicationDoseScheduleController {
  constructor(private readonly scheduleService: MedicationScheduleService) {}

  @Get()
  @AccountTypes(...INPATIENT_NURSING_READ_ACCESS)
  @ApiOperation({ summary: 'List dose schedules for an admission' })
  list(
    @Param('admissionId') admissionId: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('dueOnly') dueOnly?: string,
  ) {
    const active =
      activeOnly === undefined ||
      activeOnly === 'true' ||
      activeOnly === '1';
    const due = dueOnly === 'true' || dueOnly === '1';
    return this.scheduleService.listDoseSchedulesForAdmission(
      admissionId,
      active,
      due,
    );
  }
}
