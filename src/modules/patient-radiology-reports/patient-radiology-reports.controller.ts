import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListRadiologyReportsQueryDto } from './dto/list-radiology-reports-query.dto';
import {
  RadiologyReportDetailDto,
  RadiologyReportListResponseDto,
} from './dto/radiology-report-response.dto';
import { PatientRadiologyReportsService } from './patient-radiology-reports.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientRadiologyReportsController {
  constructor(
    private readonly patientRadiologyReportsService: PatientRadiologyReportsService,
  ) {}

  @Get('radiology-reports')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient radiology reports (imaging scans)' })
  @ApiResponse({ status: 200, type: RadiologyReportListResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  listRadiologyReports(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListRadiologyReportsQueryDto,
  ) {
    return this.patientRadiologyReportsService.listRadiologyReports(
      req.user,
      query,
    );
  }

  @Get('radiology-reports/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single patient radiology report with findings' })
  @ApiResponse({ status: 200, type: RadiologyReportDetailDto })
  @ApiResponse({ status: 404, description: 'Radiology report not found' })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getRadiologyReport(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientRadiologyReportsService.getRadiologyReport(req.user, id);
  }
}
