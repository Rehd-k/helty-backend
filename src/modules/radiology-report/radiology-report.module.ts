import { Module } from '@nestjs/common';
import { RadiologyReportService } from './radiology-report.service';
import { RadiologyReportController } from './radiology-report.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RadiologyReportController],
  providers: [RadiologyReportService],
  exports: [RadiologyReportService],
})
export class RadiologyReportModule {}
