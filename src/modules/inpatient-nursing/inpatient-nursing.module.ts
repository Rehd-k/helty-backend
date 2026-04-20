import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdmissionMedicationOrderService } from './admission-medication-order.service';
import { AdmissionMedicationOrderController } from './admission-medication-order.controller';
import { MedicationAdministrationService } from './medication-administration.service';
import { MedicationAdministrationController } from './medication-administration.controller';
import { IvFluidOrderService } from './iv-fluid-order.service';
import { IvFluidOrderController } from './iv-fluid-order.controller';
import { IvMonitoringService } from './iv-monitoring.service';
import { IvMonitoringController } from './iv-monitoring.controller';
import { IntakeOutputRecordService } from './intake-output-record.service';
import { IntakeOutputRecordController } from './intake-output-record.controller';
import { NursingNoteService } from './nursing-note.service';
import { NursingNoteController } from './nursing-note.controller';
import { ProcedureRecordService } from './procedure-record.service';
import { ProcedureRecordController } from './procedure-record.controller';
import { WoundAssessmentService } from './wound-assessment.service';
import { WoundAssessmentController } from './wound-assessment.controller';
import { CarePlanService } from './care-plan.service';
import { CarePlanController } from './care-plan.controller';
import { MonitoringChartService } from './monitoring-chart.service';
import { MonitoringChartController } from './monitoring-chart.controller';
import { HandoverReportService } from './handover-report.service';
import { HandoverReportController } from './handover-report.controller';
import { NurseAssignmentService } from './nurse-assignment.service';
import { NurseAssignmentController } from './nurse-assignment.controller';
import { AlertLogService } from './alert-log.service';
import { AlertLogController } from './alert-log.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdmissionMedicationOrderController,
    MedicationAdministrationController,
    IvFluidOrderController,
    IvMonitoringController,
    IntakeOutputRecordController,
    NursingNoteController,
    ProcedureRecordController,
    WoundAssessmentController,
    CarePlanController,
    MonitoringChartController,
    HandoverReportController,
    NurseAssignmentController,
    AlertLogController,
  ],
  providers: [
    AdmissionMedicationOrderService,
    MedicationAdministrationService,
    IvFluidOrderService,
    IvMonitoringService,
    IntakeOutputRecordService,
    NursingNoteService,
    ProcedureRecordService,
    WoundAssessmentService,
    CarePlanService,
    MonitoringChartService,
    HandoverReportService,
    NurseAssignmentService,
    AlertLogService,
  ],
  exports: [
    AdmissionMedicationOrderService,
    MedicationAdministrationService,
    IvFluidOrderService,
    IvMonitoringService,
    IntakeOutputRecordService,
    NursingNoteService,
    ProcedureRecordService,
    WoundAssessmentService,
    CarePlanService,
    MonitoringChartService,
    HandoverReportService,
    NurseAssignmentService,
    AlertLogService,
  ],
})
export class InpatientNursingModule {}
