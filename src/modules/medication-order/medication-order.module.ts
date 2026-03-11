import { Module } from '@nestjs/common';
import { MedicationOrderService } from './medication-order.service';
import { MedicationOrderController } from './medication-order.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MedicationOrderController],
  providers: [MedicationOrderService],
  exports: [MedicationOrderService],
})
export class MedicationOrderModule {}
