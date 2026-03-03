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
import { LabReportService } from './lab-report.service';
import { CreateLabReportDto, UpdateLabReportDto } from './dto/create-lab-report.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';

@ApiTags('Lab Report')
@Roles('laboratory')
@Controller('lab-reports')
export class LabReportController {
  constructor(private readonly labReportService: LabReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new lab report' })
  create(@Body() createLabReportDto: CreateLabReportDto) {
    return this.labReportService.create(createLabReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lab reports' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.labReportService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all lab reports for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.labReportService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab report by ID' })
  findOne(@Param('id') id: string) {
    return this.labReportService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lab report' })
  update(
    @Param('id') id: string,
    @Body() updateLabReportDto: UpdateLabReportDto,
  ) {
    return this.labReportService.update(id, updateLabReportDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lab report' })
  remove(@Param('id') id: string) {
    return this.labReportService.remove(id);
  }
}
