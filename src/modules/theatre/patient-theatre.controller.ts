import { Controller, Get, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import { TheatreScheduleService } from './theatre-schedule.service';

@ApiTags('patient-portal')
@ApiBearerAuth()
@Controller('patient/theatre')
export class PatientTheatreController {
  constructor(
    private readonly theatreScheduleService: TheatreScheduleService,
    private readonly family: PatientFamilyService,
  ) {}

  @Get('schedules')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiOperation({
    summary: 'List theatre schedules / surgery requests for the patient',
  })
  @ApiResponse({ status: 200, description: 'Theatre schedules for the patient' })
  async listSchedules(
    @Request() req: { user: PatientJwtPayload },
    @Query('forPatientId') forPatientId?: string,
  ) {
    const patientId = await this.family.resolveSubjectPatientId(
      req.user,
      forPatientId,
    );
    return this.theatreScheduleService.findAllForPatient(patientId);
  }
}
