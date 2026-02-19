import { Module } from '@nestjs/common';
import { DoctorReportService } from './doctor-report.service';
import { DoctorReportController } from './doctor-report.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DoctorReportController],
  providers: [DoctorReportService],
  exports: [DoctorReportService],
})
export class DoctorReportModule {}
