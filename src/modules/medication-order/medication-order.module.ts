import { Module } from '@nestjs/common';
import { MedicationOrderService } from './medication-order.service';
import { MedicationOrderController } from './medication-order.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { MedicationScheduleModule } from '../medication-schedule/medication-schedule.module';

@Module({
  imports: [PrismaModule, InvoiceModule, MedicationScheduleModule],
  controllers: [MedicationOrderController],
  providers: [MedicationOrderService],
  exports: [MedicationOrderService],
})
export class MedicationOrderModule {}
