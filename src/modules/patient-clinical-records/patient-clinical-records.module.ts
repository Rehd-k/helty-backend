import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientClinicalRecordsController } from './patient-clinical-records.controller';
import { PatientClinicalRecordsService } from './patient-clinical-records.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientClinicalRecordsController],
  providers: [PatientClinicalRecordsService],
  exports: [PatientClinicalRecordsService],
})
export class PatientClinicalRecordsModule {}
