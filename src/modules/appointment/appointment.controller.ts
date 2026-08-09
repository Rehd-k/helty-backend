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
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/create-appointment.dto';
import { AppointmentCalendarCountsQueryDto } from './dto/appointment-calendar-counts.query.dto';
import {
  ConfirmAppointmentRequestDto,
  DenyAppointmentRequestDto,
  ListAppointmentRequestsQueryDto,
} from './dto/appointment-request.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';

const APPOINTMENT_REQUEST_ACCESS = [
  'MEDICAL_RECORDS',
  'FRONT_DESK',
  'SUPER_ADMIN',
] as const;

@ApiTags('Appointment')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new appointment' })
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.appointmentService.create(createAppointmentDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  findAll(@Query() query: DateRangeSkipTakeDto) {
    return this.appointmentService.findAll(query);
  }

  @Get('calendar-counts')
  @ApiOperation({
    summary:
      'Lightweight per-day appointment counts for calendar month grid (UTC date keys; same date window as GET /appointments)',
  })
  calendarCounts(@Query() query: AppointmentCalendarCountsQueryDto) {
    return this.appointmentService.getCalendarCounts(query);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming appointments' })
  getUpcomingAppointments() {
    return this.appointmentService.getUpcomingAppointments();
  }

  @Get('requests')
  @AccountTypes(...APPOINTMENT_REQUEST_ACCESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List patient appointment requests (Medical Records / Front Desk)',
  })
  listRequests(@Query() query: ListAppointmentRequestsQueryDto) {
    return this.appointmentService.listRequests(query.status);
  }

  @Post(':id/confirm')
  @AccountTypes(...APPOINTMENT_REQUEST_ACCESS)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a REQUESTED appointment and assign a physician',
  })
  confirmRequest(
    @Param('id') id: string,
    @Body() dto: ConfirmAppointmentRequestDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.appointmentService.confirmRequest(id, dto, req.user.sub);
  }

  @Post(':id/deny')
  @AccountTypes(...APPOINTMENT_REQUEST_ACCESS)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deny a REQUESTED appointment (sets CANCELLED)' })
  denyRequest(
    @Param('id') id: string,
    @Body() dto: DenyAppointmentRequestDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.appointmentService.denyRequest(id, dto, req.user.sub);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get appointments for a specific patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.appointmentService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findOne(@Param('id') id: string) {
    return this.appointmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update appointment' })
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.appointmentService.update(
      id,
      updateAppointmentDto,
      req.user.sub,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete appointment' })
  remove(@Param('id') id: string) {
    return this.appointmentService.remove(id);
  }
}
