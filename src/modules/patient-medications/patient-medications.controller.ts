import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import {
  MarkDoseTakenDto,
} from './dto/mark-dose-taken.dto';
import {
  MedicationDashboardResponseDto,
  MarkDoseTakenResponseDto,
  PrescriptionHistoryListResponseDto,
  RefillRequestResponseDto,
} from './dto/medication-response.dto';
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
  @ApiOperation({ summary: 'Medications dashboard: next doses, today schedule, active prescriptions' })
  @ApiResponse({ status: 200, type: MedicationDashboardResponseDto })
  @ApiResponse({ status: 403, description: 'Staff token cannot access patient routes' })
  getDashboard(@Request() req: { user: PatientJwtPayload }) {
    return this.patientMedicationsService.getDashboard(req.user);
  }

  @Post('medications/doses/:doseId/taken')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a scheduled dose as taken' })
  @ApiResponse({ status: 200, type: MarkDoseTakenResponseDto })
  @ApiResponse({ status: 404, description: 'Dose not found' })
  @ApiResponse({ status: 403, description: 'Staff token or dose not owned by patient' })
  @ApiResponse({ status: 409, description: 'Dose already taken or skipped' })
  markDoseTaken(
    @Request() req: { user: PatientJwtPayload },
    @Param('doseId') doseId: string,
    @Body() dto: MarkDoseTakenDto,
  ) {
    return this.patientMedicationsService.markDoseTaken(req.user, doseId, dto);
  }

  @Get('medications/prescriptions')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Paginated prescription history',
    description: `Default status filter: ${DEFAULT_HISTORY_STATUSES.join(', ')}`,
  })
  @ApiResponse({ status: 200, type: PrescriptionHistoryListResponseDto })
  @ApiResponse({ status: 403, description: 'Staff token cannot access patient routes' })
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
  @ApiResponse({ status: 404, description: 'Prescription not found or not active' })
  @ApiResponse({ status: 403, description: 'Staff token or prescription not owned by patient' })
  @ApiResponse({ status: 409, description: 'Pending refill already exists' })
  createRefillRequest(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: RefillRequestDto,
  ) {
    return this.patientMedicationsService.createRefillRequest(
      req.user,
      id,
      dto,
    );
  }
}
