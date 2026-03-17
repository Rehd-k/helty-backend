import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { RadiologyRequestController } from './radiology-request.controller';
import { RadiologyRequestService } from './radiology-request.service';
import { RadiologyWorklistController } from './radiology-worklist.controller';
import { RadiologyScheduleController } from './radiology-schedule.controller';
import { RadiologyScheduleService } from './radiology-schedule.service';
import { RadiologyProcedureController } from './radiology-procedure.controller';
import { RadiologyProcedureService } from './radiology-procedure.service';
import { RadiologyImageController } from './radiology-image.controller';
import { RadiologyImageService } from './radiology-image.service';
import { RadiologyReportController } from './radiology-report.controller';
import { RadiologyReportService } from './radiology-report.service';
import { RadiologyDashboardController } from './radiology-dashboard.controller';
import { RadiologyDashboardService } from './radiology-dashboard.service';
import { RadiologyHistoryController } from './radiology-history.controller';
import { RadiologyHistoryService } from './radiology-history.service';
import { RadiologyMachineController } from './radiology-machine.controller';
import { RadiologyMachineService } from './radiology-machine.service';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [
    RadiologyRequestController,
    RadiologyWorklistController,
    RadiologyScheduleController,
    RadiologyProcedureController,
    RadiologyImageController,
    RadiologyReportController,
    RadiologyDashboardController,
    RadiologyHistoryController,
    RadiologyMachineController,
  ],
  providers: [
    RadiologyRequestService,
    RadiologyScheduleService,
    RadiologyProcedureService,
    RadiologyImageService,
    RadiologyReportService,
    RadiologyDashboardService,
    RadiologyHistoryService,
    RadiologyMachineService,
  ],
  exports: [
    RadiologyRequestService,
    RadiologyScheduleService,
    RadiologyProcedureService,
    RadiologyImageService,
    RadiologyReportService,
    RadiologyDashboardService,
    RadiologyHistoryService,
    RadiologyMachineService,
  ],
})
export class RadiologyModule {}
