import { Module } from '@nestjs/common';
import { MedicationRequestService } from './medication-request.service';
import { MedicationRequestController } from './medication-request.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [MedicationRequestController],
  providers: [MedicationRequestService],
  exports: [MedicationRequestService],
})
export class MedicationRequestModule {}
