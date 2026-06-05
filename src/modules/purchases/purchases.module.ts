import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PurchasesManufacturerController } from './purchases.manufacturer.controller';
import { PurchasesManufacturerService } from './purchases.manufacturer.service';
import { PurchasesSupplierController } from './purchases.supplier.controller';
import { PurchasesSupplierService } from './purchases.supplier.service';
import { PurchasesLocationController } from './purchases.location.controller';
import { PurchasesLocationService } from './purchases.location.service';
import { PurchasesItemController } from './purchases.item.controller';
import { PurchasesItemService } from './purchases.item.service';
import { PurchasesRequisitionController } from './purchases.requisition.controller';
import { PurchasesRequisitionService } from './purchases.requisition.service';
import { PurchasesBatchController } from './purchases.batch.controller';
import { PurchasesBatchService } from './purchases.batch.service';
import { PurchasesPurchaseOrderController } from './purchases.purchase-order.controller';
import { PurchasesPurchaseOrderService } from './purchases.purchase-order.service';
import { PurchasesGoodsReceiptController } from './purchases.goods-receipt.controller';
import { PurchasesGoodsReceiptService } from './purchases.goods-receipt.service';
import { PurchasesStockTransferController } from './purchases.stock-transfer.controller';
import { PurchasesStockTransferService } from './purchases.stock-transfer.service';
import { PurchasesDashboardController } from './purchases.dashboard.controller';
import { PurchasesDashboardService } from './purchases.dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PurchasesManufacturerController,
    PurchasesSupplierController,
    PurchasesLocationController,
    PurchasesItemController,
    PurchasesRequisitionController,
    PurchasesBatchController,
    PurchasesPurchaseOrderController,
    PurchasesGoodsReceiptController,
    PurchasesStockTransferController,
    PurchasesDashboardController,
  ],
  providers: [
    PurchasesManufacturerService,
    PurchasesSupplierService,
    PurchasesLocationService,
    PurchasesItemService,
    PurchasesRequisitionService,
    PurchasesBatchService,
    PurchasesPurchaseOrderService,
    PurchasesGoodsReceiptService,
    PurchasesStockTransferService,
    PurchasesDashboardService,
  ],
  exports: [
    PurchasesRequisitionService,
    PurchasesItemService,
    PurchasesPurchaseOrderService,
  ],
})
export class PurchasesModule {}
