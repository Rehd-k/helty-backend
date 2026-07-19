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
import {
  LabReportDetailDto,
  LabReportListResponseDto,
} from './dto/lab-report-response.dto';
import { ListLabReportsQueryDto } from './dto/list-lab-reports-query.dto';
import { PatientLabReportsService } from './patient-lab-reports.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientLabReportsController {
  constructor(
    private readonly patientLabReportsService: PatientLabReportsService,
  ) {}

  @Get('lab-reports')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient lab reports (lab orders)' })
  @ApiResponse({ status: 200, type: LabReportListResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  listLabReports(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListLabReportsQueryDto,
  ) {
    return this.patientLabReportsService.listLabReports(req.user, query);
  }

  @Get('lab-reports/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single patient lab report with result panels' })
  @ApiResponse({ status: 200, type: LabReportDetailDto })
  @ApiResponse({ status: 404, description: 'Lab report not found' })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getLabReport(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Query('forPatientId') forPatientId?: string,
  ) {
    return this.patientLabReportsService.getLabReport(
      req.user,
      id,
      forPatientId,
    );
  }
}
