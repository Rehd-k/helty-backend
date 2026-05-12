import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StoreModule } from '../store/store.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceDrugController } from './invoice-drug.controller';
import { InvoiceDrugService } from './invoice-drug.service';
import { InvoiceConsumableController } from './invoice-consumable.controller';
import { InvoiceConsumableService } from './invoice-consumable.service';
import { InvoiceCoverageController } from './coverage/coverage.controller';
import { InvoiceCoverageService } from './coverage/coverage.service';

@Module({
  imports: [PrismaModule, StoreModule],
  controllers: [
    InvoiceController,
    InvoiceDrugController,
    InvoiceConsumableController,
    InvoiceCoverageController,
  ],
  providers: [
    InvoiceService,
    InvoiceDrugService,
    InvoiceConsumableService,
    InvoiceCoverageService,
  ],
  exports: [
    InvoiceService,
    InvoiceDrugService,
    InvoiceConsumableService,
    InvoiceCoverageService,
  ],
})
export class InvoiceModule {}
