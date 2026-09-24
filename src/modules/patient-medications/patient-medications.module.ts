import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FcmModule } from '../fcm/fcm.module';
import { PatientFamilyModule } from '../patient-family/patient-family.module';
import { MedicationOrderPrescriptionSyncService } from './medication-order-prescription.sync';
import { PrescriptionRefillFulfillmentService } from './prescription-refill-fulfillment.service';
import { PatientMedicationDoseGeneratorService } from './patient-medication-dose.generator';
import { PatientMedicationDoseScheduler } from './patient-medication-dose.scheduler';
import { PatientMedicationReminderService } from './patient-medication-reminder.service';
import { PatientMedicationsController } from './patient-medications.controller';
import { PatientMedicationsService } from './patient-medications.service';

@Module({
  imports: [PrismaModule, PatientFamilyModule, FcmModule],
  controllers: [PatientMedicationsController],
  providers: [
    PatientMedicationsService,
    PatientMedicationDoseGeneratorService,
    PatientMedicationDoseScheduler,
    PatientMedicationReminderService,
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
