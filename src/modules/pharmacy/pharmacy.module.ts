import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PharmacyDrugController } from './pharmacy.drug.controller';
import { PharmacyDrugService } from './pharmacy.drug.service';
import { PharmacyBatchController } from './pharmacy.batch.controller';
import { PharmacyBatchService } from './pharmacy.batch.service';
import { PharmacyManufacturerController } from './pharmacy.manufacturer.controller';
import { PharmacyManufacturerService } from './pharmacy.manufacturer.service';
import { PharmacySupplierController } from './pharmacy.supplier.controller';
import { PharmacySupplierService } from './pharmacy.supplier.service';
import { PharmacyLocationController } from './pharmacy.location.controller';
import { PharmacyLocationService } from './pharmacy.location.service';
import { PharmacyConsumableController } from './pharmacy.consumable.controller';
import { PharmacyConsumableService } from './pharmacy.consumable.service';
import { PharmacyDrugInteractionController } from './pharmacy.drug-interaction.controller';
import { PharmacyDrugInteractionService } from './pharmacy.drug-interaction.service';
import { PharmacyPurchaseOrderController } from './pharmacy.purchase-order.controller';
import { PharmacyPurchaseOrderService } from './pharmacy.purchase-order.service';
import { PharmacyGoodsReceiptController } from './pharmacy.goods-receipt.controller';
import { PharmacyGoodsReceiptService } from './pharmacy.goods-receipt.service';
import { PharmacyStockTransferController } from './pharmacy.stock-transfer.controller';
import { PharmacyStockTransferService } from './pharmacy.stock-transfer.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PharmacyDrugController,
    PharmacyBatchController,
    PharmacyManufacturerController,
    PharmacySupplierController,
    PharmacyLocationController,
    PharmacyConsumableController,
    PharmacyDrugInteractionController,
    PharmacyPurchaseOrderController,
    PharmacyGoodsReceiptController,
    PharmacyStockTransferController,
  ],
  providers: [
    PharmacyDrugService,
    PharmacyBatchService,
    PharmacyManufacturerService,
    PharmacySupplierService,
    PharmacyLocationService,
    PharmacyConsumableService,
    PharmacyDrugInteractionService,
    PharmacyPurchaseOrderService,
    PharmacyGoodsReceiptService,
    PharmacyStockTransferService,
  ],
  exports: [
    PharmacyDrugService,
    PharmacyBatchService,
    PharmacyManufacturerService,
    PharmacySupplierService,
    PharmacyLocationService,
    PharmacyConsumableService,
    PharmacyDrugInteractionService,
    PharmacyPurchaseOrderService,
    PharmacyGoodsReceiptService,
    PharmacyStockTransferService,
  ],
})
export class PharmacyModule {}
