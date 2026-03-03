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
import { RadiologyReportService } from './radiology-report.service';
import { CreateRadiologyReportDto, UpdateRadiologyReportDto } from './dto/create-radiology-report.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../common/decorators';

@ApiTags('Radiology Report')
@Roles('radiology')
@Controller('radiology-reports')
export class RadiologyReportController {
  constructor(private readonly radiologyReportService: RadiologyReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new radiology report' })
  create(@Body() createRadiologyReportDto: CreateRadiologyReportDto) {
    return this.radiologyReportService.create(createRadiologyReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all radiology reports' })
  findAll(
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
  ) {
    return this.radiologyReportService.findAll(parseInt(skip), parseInt(take));
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all radiology reports for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.radiologyReportService.findByPatientId(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get radiology report by ID' })
  findOne(@Param('id') id: string) {
    return this.radiologyReportService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update radiology report' })
  update(
    @Param('id') id: string,
    @Body() updateRadiologyReportDto: UpdateRadiologyReportDto,
  ) {
    return this.radiologyReportService.update(id, updateRadiologyReportDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete radiology report' })
  remove(@Param('id') id: string) {
    return this.radiologyReportService.remove(id);
  }
}
