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
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Appointment')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new appointment' })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentService.create(createAppointmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.appointmentService.findAll(parseInt(skip), parseInt(take));
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
  ) {
    return this.appointmentService.update(id, updateAppointmentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete appointment' })
  remove(@Param('id') id: string) {
    return this.appointmentService.remove(id);
  }
}
