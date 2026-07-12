import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { RadiologyModule } from '../radiology/radiology.module';
import { PatientRadiologyReportsController } from './patient-radiology-reports.controller';
import { PatientRadiologyReportsService } from './patient-radiology-reports.service';

@Module({
  imports: [PrismaModule, InvoiceModule, RadiologyModule],
  controllers: [PatientRadiologyReportsController],
  providers: [PatientRadiologyReportsService],
})
export class PatientRadiologyReportsModule {}
