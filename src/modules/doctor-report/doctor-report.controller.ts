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
import { DoctorReportService } from './doctor-report.service';
import { CreateDoctorReportDto, UpdateDoctorReportDto } from './dto/create-doctor-report.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Doctor Report')
@Controller('doctor-reports')
export class DoctorReportController {
  constructor(private readonly doctorReportService: DoctorReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new doctor report' })
  create(@Body() createDoctorReportDto: CreateDoctorReportDto) {
    return this.doctorReportService.create(createDoctorReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all doctor reports' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.doctorReportService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all doctor reports for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.doctorReportService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor report by ID' })
  findOne(@Param('id') id: string) {
    return this.doctorReportService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update doctor report' })
  update(
    @Param('id') id: string,
    @Body() updateDoctorReportDto: UpdateDoctorReportDto,
  ) {
    return this.doctorReportService.update(id, updateDoctorReportDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete doctor report' })
  remove(@Param('id') id: string) {
    return this.doctorReportService.remove(id);
  }
}
