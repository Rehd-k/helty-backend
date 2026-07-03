import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MedicationOrderPrescriptionSyncService } from './medication-order-prescription.sync';
import { PrescriptionRefillFulfillmentService } from './prescription-refill-fulfillment.service';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';
import { PatientMedicationDoseScheduler } from './patient-medication-dose.scheduler';
import { PatientMedicationsController } from './patient-medications.controller';
import { PatientMedicationsService } from './patient-medications.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientMedicationsController],
  providers: [
    PatientMedicationsService,
    PatientMedicationDoseGeneratorService,
    PatientMedicationDoseScheduler,
    MedicationOrderPrescriptionSyncService,
    PrescriptionRefillFulfillmentService,
  ],
  exports: [
    PatientMedicationDoseGeneratorService,
    MedicationOrderPrescriptionSyncService,
    PrescriptionRefillFulfillmentService,
  ],
})
export class PatientMedicationsModule {}
