import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientRadiologyReportsController } from './patient-radiology-reports.controller';
import { PatientRadiologyReportsService } from './patient-radiology-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientRadiologyReportsController],
  providers: [PatientRadiologyReportsService],
})
export class PatientRadiologyReportsModule {}
