import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MedicationScheduleService } from './medication-schedule.service';
import { MedicationDoseAlertScheduler } from './medication-dose-alert.scheduler';

@Module({
  imports: [PrismaModule],
  providers: [MedicationScheduleService, MedicationDoseAlertScheduler],
  exports: [MedicationScheduleService],
})
export class MedicationScheduleModule {}
