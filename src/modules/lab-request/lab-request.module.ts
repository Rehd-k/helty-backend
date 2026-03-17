import { Module } from '@nestjs/common';
import { LabRequestService } from './lab-request.service';
import { LabRequestController } from './lab-request.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [LabRequestController],
  providers: [LabRequestService],
  exports: [LabRequestService],
})
export class LabRequestModule {}
