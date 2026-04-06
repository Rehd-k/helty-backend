import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceDrugController } from './invoice-drug.controller';
import { InvoiceDrugService } from './invoice-drug.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceController, InvoiceDrugController],
  providers: [InvoiceService, InvoiceDrugService],
  exports: [InvoiceService, InvoiceDrugService],
})
export class InvoiceModule {}
