import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientLabReportsController } from './patient-lab-reports.controller';
import { PatientLabReportsService } from './patient-lab-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientLabReportsController],
  providers: [PatientLabReportsService],
})
export class PatientLabReportsModule {}
