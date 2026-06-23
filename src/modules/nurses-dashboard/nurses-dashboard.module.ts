import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MedicationScheduleModule } from '../medication-schedule/medication-schedule.module';
import { NursesDashboardController } from './nurses-dashboard.controller';
import { NursesDashboardService } from './nurses-dashboard.service';

@Module({
  imports: [PrismaModule, MedicationScheduleModule],
  controllers: [NursesDashboardController],
  providers: [NursesDashboardService],
  exports: [NursesDashboardService],
})
export class NursesDashboardModule {}
