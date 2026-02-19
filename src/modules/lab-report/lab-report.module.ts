import { Module } from '@nestjs/common';
import { LabReportService } from './lab-report.service';
import { LabReportController } from './lab-report.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LabReportController],
  providers: [LabReportService],
  exports: [LabReportService],
})
export class LabReportModule {}
