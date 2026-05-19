import { Logger, Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { PatientController } from './patient.controller';
import { PatientChartService } from './patient-chart.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [PatientController],
  providers: [PatientService, PatientChartService],
  exports: [PatientService, PatientChartService],
})
export class PatientModule {}
