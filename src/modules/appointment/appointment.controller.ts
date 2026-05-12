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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

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
