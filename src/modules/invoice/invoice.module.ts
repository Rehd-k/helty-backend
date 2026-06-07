import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StoreModule } from '../store/store.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceDrugController } from './invoice-drug.controller';
import { InvoiceDrugService } from './invoice-drug.service';
import { InvoiceConsumableController } from './invoice-consumable.controller';
import { InvoiceConsumableService } from './invoice-consumable.service';
import { InvoicePurchaseController } from './invoice-purchase.controller';
import { InvoicePurchaseService } from './invoice-purchase.service';
import { InvoiceCoverageController } from './coverage/coverage.controller';
import { InvoiceCoverageService } from './coverage/coverage.service';

@Module({
  imports: [PrismaModule, StoreModule, PurchasesModule],
  controllers: [
    InvoiceController,
    InvoiceDrugController,
    InvoiceConsumableController,
    InvoicePurchaseController,
    InvoiceCoverageController,
  ],
  providers: [
    InvoiceService,
    InvoiceDrugService,
    InvoiceConsumableService,
    InvoicePurchaseService,
    InvoiceCoverageService,
  ],
  exports: [
    InvoiceService,
    InvoiceDrugService,
    InvoiceConsumableService,
    InvoicePurchaseService,
    InvoiceCoverageService,
  ],
})
export class InvoiceModule {}
