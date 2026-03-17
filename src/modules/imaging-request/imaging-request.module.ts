import { Module } from '@nestjs/common';
import { ImagingRequestService } from './imaging-request.service';
import { ImagingRequestController } from './imaging-request.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [ImagingRequestController],
  providers: [ImagingRequestService],
  exports: [ImagingRequestService],
})
export class ImagingRequestModule {}
