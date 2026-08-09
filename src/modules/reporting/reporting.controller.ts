import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AccountTypes } from '../../common/decorators';
import {
  ReportDateRangeQueryDto,
  ReportExportFormat,
  RequestsByWardReportQueryDto,
  WardAdmissionsReportQueryDto,
} from './dto/reporting-query.dto';
import { rowsToCsv, rowsToXlsxBuffer, ReportRow } from './reporting-export.util';
import { ReportingService } from './reporting.service';

const REPORTING_ACCESS = [
  'MEDICAL_RECORDS',
  'CMD',
  'CMAC',
  'SUPER_ADMIN',
  'BILLING',
  'BILLS',
  'NURSING_CHARGE',
  'LABORATORY',
  'RADIOLOGY',
  'PHARMACY',
] as const;

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@AccountTypes(...REPORTING_ACCESS)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  private async respond(
    res: Response,
    format: ReportExportFormat | undefined,
    filename: string,
    sheetName: string,
    payload: unknown,
    flatRows: ReportRow[],
  ) {
    const fmt = format ?? ReportExportFormat.JSON;
    if (fmt === ReportExportFormat.CSV) {
      const csv = rowsToCsv(flatRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.csv"`,
      );
      return new StreamableFile(Buffer.from(csv, 'utf8'));
    }
    if (fmt === ReportExportFormat.XLSX) {
      const buffer = await rowsToXlsxBuffer(flatRows, sheetName);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.xlsx"`,
      );
      return new StreamableFile(buffer);
    }
    return payload;
  }

  @Get('ward-admissions')
  @ApiOperation({
    summary: 'Ward admissions report',
    description:
      'Admissions in range with wardHistory segments, LOS, reason, admit/discharge dates. Supports ?format=csv|xlsx.',
  })
  @ApiProduces(
    'application/json',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async wardAdmissions(
    @Query() query: WardAdmissionsReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reporting.wardAdmissions(query);
    return this.respond(
      res,
      query.format,
      'ward-admissions',
      'Ward Admissions',
      payload,
      this.reporting.wardAdmissionsFlatRows(payload),
    );
  }

  @Get('requests-by-ward')
  @ApiOperation({
    summary: 'Requests grouped by ward',
    description:
      'Lab, radiology, or pharmacy requests in range grouped by wardId (null = OPD). Supports ?format=csv|xlsx.',
  })
  async requestsByWard(
    @Query() query: RequestsByWardReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reporting.requestsByWard(query);
    return this.respond(
      res,
      query.format,
      `requests-by-ward-${query.type}`,
      'Requests By Ward',
      payload,
      this.reporting.requestsByWardFlatRows(payload),
    );
  }

  @Get('discharge-history')
  @ApiOperation({
    summary: 'Discharge history',
    description:
      'DISCHARGED/DECEASED admissions with both billingClearedAt and nursesClearedAt set. Includes invoice ids. Supports ?format=csv|xlsx.',
  })
  async dischargeHistory(
    @Query() query: ReportDateRangeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reporting.dischargeHistory(query);
    return this.respond(
      res,
      query.format,
      'discharge-history',
      'Discharge History',
      payload,
      this.reporting.dischargeHistoryFlatRows(payload),
    );
  }

  @Get('medical-records/attendance')
  @ApiOperation({
    summary: 'Medical records attendance',
    description:
      'Encounters in range: patient names, diagnosis, lab/radiology requests, doctor. Supports ?format=csv|xlsx.',
  })
  async medicalRecordsAttendance(
    @Query() query: ReportDateRangeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reporting.medicalRecordsAttendance(query);
    return this.respond(
      res,
      query.format,
      'medical-records-attendance',
      'Attendance',
      payload,
      this.reporting.medicalRecordsAttendanceFlatRows(payload),
    );
  }

  @Get('medical-records/admissions')
  @ApiOperation({
    summary: 'Medical records admissions summary',
    description:
      'Admission counts by reason and ward. Supports ?format=csv|xlsx.',
  })
  async medicalRecordsAdmissions(
    @Query() query: ReportDateRangeQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reporting.medicalRecordsAdmissions(query);
    return this.respond(
      res,
      query.format,
      'medical-records-admissions',
      'Admissions',
      payload,
      this.reporting.medicalRecordsAdmissionsFlatRows(payload),
    );
  }
}
