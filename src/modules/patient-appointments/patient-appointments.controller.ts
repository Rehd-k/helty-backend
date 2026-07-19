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
import { AvailabilityQueryDto, ListDoctorsQueryDto } from './dto/booking-query.dto';
import { CreatePatientAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentsDashboardQueryDto,
  ListAppointmentsQueryDto,
} from './dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import {
  AppointmentDetailDto,
  AppointmentListResponseDto,
  AppointmentsDashboardResponseDto,
  AvailabilityResponseDto,
  BookingDoctorListResponseDto,
  CancelAppointmentResponseDto,
  SpecialtyListResponseDto,
} from './dto/appointment-response.dto';
import { PatientAppointmentsService } from './patient-appointments.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientAppointmentsController {
  constructor(
    private readonly patientAppointmentsService: PatientAppointmentsService,
  ) {}

  @Get('appointments/dashboard')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Appointments dashboard summary' })
  @ApiResponse({ status: 200, type: AppointmentsDashboardResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getDashboard(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: AppointmentsDashboardQueryDto,
  ) {
    return this.patientAppointmentsService.getDashboard(req.user, query);
  }

  @Get('appointments/specialties')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List bookable medical specialties' })
  @ApiResponse({ status: 200, type: SpecialtyListResponseDto })
  listSpecialties() {
    return this.patientAppointmentsService.listSpecialties();
  }

  @Get('appointments/doctors')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List doctors for a specialty' })
  @ApiResponse({ status: 200, type: BookingDoctorListResponseDto })
  @ApiResponse({ status: 422, description: 'Invalid specialtyId' })
  listDoctors(@Query() query: ListDoctorsQueryDto) {
    return this.patientAppointmentsService.listDoctors(query);
  }

  @Get('appointments/availability')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Doctor availability slots for a date' })
  @ApiResponse({ status: 200, type: AvailabilityResponseDto })
  @ApiResponse({ status: 422, description: 'Invalid doctorId or date' })
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.patientAppointmentsService.getAvailability(query);
  }

  @Get('appointments')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient appointments' })
  @ApiResponse({ status: 200, type: AppointmentListResponseDto })
  listAppointments(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.patientAppointmentsService.listAppointments(req.user, query);
  }

  @Post('appointments')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book a new appointment' })
  @ApiResponse({ status: 201, type: AppointmentDetailDto })
  @ApiResponse({ status: 409, description: 'Slot unavailable' })
  @ApiResponse({ status: 422, description: 'Invalid doctorId or scheduledAt' })
  createAppointment(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: CreatePatientAppointmentDto,
  ) {
    return this.patientAppointmentsService.createAppointment(req.user, dto);
  }

  @Get('appointments/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get appointment detail' })
  @ApiResponse({ status: 200, type: AppointmentDetailDto })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  getAppointment(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Query('forPatientId') forPatientId?: string,
  ) {
    return this.patientAppointmentsService.getAppointment(
      req.user,
      id,
      forPatientId,
    );
  }

  @Patch('appointments/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reschedule or update an appointment' })
  @ApiResponse({ status: 200, type: AppointmentDetailDto })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Cannot reschedule or slot taken' })
  @ApiResponse({ status: 422, description: 'Invalid scheduledAt' })
  rescheduleAppointment(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.patientAppointmentsService.rescheduleAppointment(
      req.user,
      id,
      dto,
    );
  }

  @Delete('appointments/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment' })
  @ApiResponse({ status: 200, type: CancelAppointmentResponseDto })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Appointment cannot be cancelled' })
  cancelAppointment(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientAppointmentsService.cancelAppointment(req.user, id);
  }
}
