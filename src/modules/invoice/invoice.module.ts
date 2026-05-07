import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceDrugController } from './invoice-drug.controller';
import { InvoiceDrugService } from './invoice-drug.service';
import { InvoiceCoverageController } from './coverage/coverage.controller';
import { InvoiceCoverageService } from './coverage/coverage.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceController, InvoiceDrugController, InvoiceCoverageController],
  providers: [InvoiceService, InvoiceDrugService, InvoiceCoverageService],
  exports: [InvoiceService, InvoiceDrugService, InvoiceCoverageService],
})
export class InvoiceModule {}
