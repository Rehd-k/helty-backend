import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
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
  ],
  exports: [PatientMedicationDoseGeneratorService],
})
export class PatientMedicationsModule {}
