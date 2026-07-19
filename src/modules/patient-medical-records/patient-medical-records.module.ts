import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientFamilyModule } from '../patient-family/patient-family.module';
import { PatientMedicalRecordsController } from './patient-medical-records.controller';
import { PatientMedicalRecordsService } from './patient-medical-records.service';

@Module({
  imports: [PrismaModule, PatientFamilyModule],
  controllers: [PatientMedicalRecordsController],
  providers: [PatientMedicalRecordsService],
})
export class PatientMedicalRecordsModule {}
