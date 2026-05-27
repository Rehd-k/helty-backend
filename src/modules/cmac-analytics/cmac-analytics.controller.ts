import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { CmacAnalyticsQueryDto } from './dto/cmac-analytics-query.dto';
import { parseCmacPeriod } from './cmac-analytics.helpers';
import { CmacPatientActivityService } from './services/cmac-patient-activity.service';
import { CmacClinicalService } from './services/cmac-clinical.service';
import { CmacLaboratoryService } from './services/cmac-laboratory.service';
import { CmacPharmacyService } from './services/cmac-pharmacy.service';
import { CmacOperationsService } from './services/cmac-operations.service';
import { CmacQualityService } from './services/cmac-quality.service';
import { CmacStaffService } from './services/cmac-staff.service';
import { CmacInsightsService } from './services/cmac-insights.service';
import { CmacOverviewService } from './services/cmac-overview.service';

@ApiTags('CMAC Analytics')
@ApiBearerAuth()
@AccountTypes('CMAC', 'SUPER_ADMIN')
@Controller('cmac/analytics')
export class CmacAnalyticsController {
  constructor(
    private readonly patientActivitySvc: CmacPatientActivityService,
    private readonly clinicalSvc: CmacClinicalService,
    private readonly laboratorySvc: CmacLaboratoryService,
    private readonly pharmacySvc: CmacPharmacyService,
    private readonly operationsSvc: CmacOperationsService,
    private readonly qualitySvc: CmacQualityService,
    private readonly staffSvc: CmacStaffService,
    private readonly insightsSvc: CmacInsightsService,
    private readonly overviewSvc: CmacOverviewService,
  ) {}

  private ctx(q: CmacAnalyticsQueryDto) {
    return parseCmacPeriod(q.period, q.asOf);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Executive dashboard landing payload' })
  getOverview(@Query() q: CmacAnalyticsQueryDto) {
    return this.overviewSvc.getOverview(this.ctx(q));
  }

  @Get('insights')
  @ApiOperation({ summary: 'Rule-based system insights' })
  getInsights(@Query() q: CmacAnalyticsQueryDto) {
    return this.insightsSvc.generate(this.ctx(q), q.limit ?? 10);
  }

  @Get('patient-activity')
  @ApiOperation({ summary: 'Patient registration, OPD, admissions, referrals' })
  patientActivity(@Query() q: CmacAnalyticsQueryDto) {
    return this.patientActivitySvc.getReport(this.ctx(q));
  }

  @Get('clinical')
  @ApiOperation({ summary: 'Diagnoses, outcomes, readmissions, LOS' })
  clinical(@Query() q: CmacAnalyticsQueryDto) {
    return this.clinicalSvc.getReport(this.ctx(q), q.limit ?? 10);
  }

  @Get('laboratory')
  @ApiOperation({ summary: 'Lab volume, TAT, critical results' })
  laboratory(@Query() q: CmacAnalyticsQueryDto) {
    return this.laboratorySvc.getReport(this.ctx(q), q.limit ?? 10);
  }

  @Get('pharmacy')
  @ApiOperation({ summary: 'Prescribing, stock, antibiotics, waste' })
  pharmacy(@Query() q: CmacAnalyticsQueryDto) {
    return this.pharmacySvc.getReport(this.ctx(q), q.limit ?? 10);
  }

  @Get('operations')
  @ApiOperation({ summary: 'Appointments, wait times, workload, utilization' })
  operations(@Query() q: CmacAnalyticsQueryDto) {
    return this.operationsSvc.getReport(this.ctx(q), q.limit ?? 10);
  }

  @Get('quality')
  @ApiOperation({ summary: 'Incidents, infections, complaints, audit flags' })
  quality(@Query() q: CmacAnalyticsQueryDto) {
    return this.qualitySvc.getReport(this.ctx(q));
  }

  @Get('staff')
  @ApiOperation({ summary: 'Doctor and lab workload, department efficiency' })
  staffPerformance(@Query() q: CmacAnalyticsQueryDto) {
    return this.staffSvc.getReport(this.ctx(q), q.limit ?? 10);
  }
}
