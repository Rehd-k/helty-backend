import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  DEFAULT_HISTORY_STATUSES,
  ListPrescriptionsQueryDto,
} from './dto/list-prescriptions-query.dto';
import { MarkDoseTakenDto } from './dto/mark-dose-taken.dto';
import {
  MedicationCalendarResponseDto,
  MedicationDashboardResponseDto,
  MarkDoseTakenResponseDto,
  PrescriptionDosesResponseDto,
  PrescriptionHistoryListResponseDto,
  RefillRequestResponseDto,
  ScheduleUpdateResponseDto,
} from './dto/medication-response.dto';
import {
  FamilySubjectQueryDto,
  MedicationCalendarQueryDto,
  SetScheduleStartDto,
} from './dto/medication-schedule.dto';
import { RefillRequestDto } from './dto/refill-request.dto';
import { PatientMedicationsService } from './patient-medications.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientMedicationsController {
  constructor(
    private readonly patientMedicationsService: PatientMedicationsService,
  ) {}

  @Get('medications/dashboard')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Medications dashboard: next doses, today schedule, active prescriptions',
  })
  @ApiResponse({ status: 200, type: MedicationDashboardResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getDashboard(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.getDashboard(
      req.user,
      query.forPatientId,
    );
  }

  @Get('medications/calendar')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Doses in a date range for calendar view' })
  @ApiResponse({ status: 200, type: MedicationCalendarResponseDto })
  getCalendar(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: MedicationCalendarQueryDto,
  ) {
    return this.patientMedicationsService.getCalendar(
      req.user,
      query.from,
      query.to,
      query.forPatientId,
    );
  }

  @Get('medications/prescriptions/:id/doses')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full dose timeline for one prescription' })
  @ApiResponse({ status: 200, type: PrescriptionDosesResponseDto })
  getPrescriptionDoses(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.getPrescriptionDoses(
      req.user,
      id,
      query.forPatientId,
    );
  }

  @Post('medications/doses/:doseId/taken')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a scheduled dose as taken' })
  @ApiResponse({ status: 200, type: MarkDoseTakenResponseDto })
  @ApiResponse({ status: 404, description: 'Dose not found' })
  @ApiResponse({
    status: 403,
    description: 'Staff token or dose not owned by patient',
  })
  @ApiResponse({ status: 409, description: 'Dose already taken or skipped' })
  markDoseTaken(
    @Request() req: { user: PatientJwtPayload },
    @Param('doseId') doseId: string,
    @Body() dto: MarkDoseTakenDto,
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.markDoseTaken(
      req.user,
      doseId,
      dto,
      query.forPatientId,
    );
  }

  @Patch('medications/prescriptions/:id/schedule-start')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set deferred medication start date and confirm schedule',
  })
  @ApiResponse({ status: 200, type: ScheduleUpdateResponseDto })
  setScheduleStart(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: SetScheduleStartDto,
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.setScheduleStart(
      req.user,
      id,
      dto.startAt,
      query.forPatientId,
    );
  }

  @Post('medications/prescriptions/:id/confirm-schedule')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm medication schedule to begin reminders' })
  @ApiResponse({ status: 200, type: ScheduleUpdateResponseDto })
  confirmSchedule(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.confirmSchedule(
      req.user,
      id,
      query.forPatientId,
    );
  }

  @Get('medications/prescriptions')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Paginated prescription history',
    description: `Default status filter: ${DEFAULT_HISTORY_STATUSES.join(', ')}`,
  })
  @ApiResponse({ status: 200, type: PrescriptionHistoryListResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  listPrescriptionHistory(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListPrescriptionsQueryDto,
  ) {
    return this.patientMedicationsService.listPrescriptionHistory(
      req.user,
      query,
    );
  }

  @Post('medications/prescriptions/:id/refill-request')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a prescription refill' })
  @ApiResponse({ status: 201, type: RefillRequestResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Prescription not found or not active',
  })
  @ApiResponse({
    status: 403,
    description: 'Staff token or prescription not owned by patient',
  })
  @ApiResponse({ status: 409, description: 'Pending refill already exists' })
  createRefillRequest(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: RefillRequestDto,
    @Query() query: FamilySubjectQueryDto,
  ) {
    return this.patientMedicationsService.createRefillRequest(
      req.user,
      id,
      dto,
      query.forPatientId,
    );
  }
}
