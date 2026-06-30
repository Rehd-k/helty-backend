import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientMedicalRecordsController } from './patient-medical-records.controller';
import { PatientMedicalRecordsService } from './patient-medical-records.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientMedicalRecordsController],
  providers: [PatientMedicalRecordsService],
})
export class PatientMedicalRecordsModule {}
