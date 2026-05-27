import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CmacAnalyticsController } from './cmac-analytics.controller';
import { CmacPatientActivityService } from './services/cmac-patient-activity.service';
import { CmacClinicalService } from './services/cmac-clinical.service';
import { CmacLaboratoryService } from './services/cmac-laboratory.service';
import { CmacPharmacyService } from './services/cmac-pharmacy.service';
import { CmacOperationsService } from './services/cmac-operations.service';
import { CmacQualityService } from './services/cmac-quality.service';
import { CmacStaffService } from './services/cmac-staff.service';
import { CmacInsightsService } from './services/cmac-insights.service';
import { CmacOverviewService } from './services/cmac-overview.service';

@Module({
  imports: [PrismaModule],
  controllers: [CmacAnalyticsController],
  providers: [
    CmacPatientActivityService,
    CmacClinicalService,
    CmacLaboratoryService,
    CmacPharmacyService,
    CmacOperationsService,
    CmacQualityService,
    CmacStaffService,
    CmacInsightsService,
    CmacOverviewService,
  ],
  exports: [
    CmacPatientActivityService,
    CmacClinicalService,
    CmacLaboratoryService,
    CmacInsightsService,
  ],
})
export class CmacAnalyticsModule {}
