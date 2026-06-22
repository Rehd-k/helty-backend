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
import { LabReportService } from './lab-report.service';
import {
  CreateLabReportDto,
  UpdateLabReportDto,
} from './dto/create-lab-report.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

const LAB_REPORT_WRITE_ACCESS = ['LAB', 'LABORATORY', 'SUPER_ADMIN'] as const;

@ApiTags('Lab Report')
@Controller('lab-reports')
export class LabReportController {
  constructor(private readonly labReportService: LabReportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...LAB_REPORT_WRITE_ACCESS)
  @ApiOperation({ summary: 'Create a new lab report' })
  create(@Body() createLabReportDto: CreateLabReportDto) {
    return this.labReportService.create(createLabReportDto);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get all lab reports' })
  findAll(@Query() query: DateRangeSkipTakeDto) {
    return this.labReportService.findAll(query);
  }

  @Get('patient/:patientId')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get all lab reports for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.labReportService.findByPatientId(patientId);
  }

  @Get(':id')
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get lab report by ID' })
  findOne(@Param('id') id: string) {
    return this.labReportService.findOne(id);
  }

  @Patch(':id')
  @AccountTypes(...LAB_REPORT_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update lab report' })
  update(
    @Param('id') id: string,
    @Body() updateLabReportDto: UpdateLabReportDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.labReportService.update(id, updateLabReportDto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...LAB_REPORT_WRITE_ACCESS)
  @ApiOperation({ summary: 'Delete lab report' })
  remove(@Param('id') id: string) {
    return this.labReportService.remove(id);
  }
}
