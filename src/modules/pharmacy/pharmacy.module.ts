import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PharmacyDrugController } from './pharmacy.drug.controller';
import { PharmacyDrugService } from './pharmacy.drug.service';
import { PharmacyDrugPriceController } from './pharmacy.drug-price.controller';
import { PharmacyDrugPriceService } from './pharmacy.drug-price.service';
import { PharmacyBatchController } from './pharmacy.batch.controller';
import { PharmacyBatchService } from './pharmacy.batch.service';
import { PharmacyManufacturerController } from './pharmacy.manufacturer.controller';
import { PharmacyManufacturerService } from './pharmacy.manufacturer.service';
import { PharmacySupplierController } from './pharmacy.supplier.controller';
import { PharmacySupplierService } from './pharmacy.supplier.service';
import { PharmacyLocationController } from './pharmacy.location.controller';
import { PharmacyLocationService } from './pharmacy.location.service';
import { PharmacyDrugInteractionController } from './pharmacy.drug-interaction.controller';
import { PharmacyDrugInteractionService } from './pharmacy.drug-interaction.service';
import { PharmacyPurchaseOrderController } from './pharmacy.purchase-order.controller';
import { PharmacyPurchaseOrderService } from './pharmacy.purchase-order.service';
import { PharmacyGoodsReceiptController } from './pharmacy.goods-receipt.controller';
import { PharmacyGoodsReceiptService } from './pharmacy.goods-receipt.service';
import { PharmacyStockTransferController } from './pharmacy.stock-transfer.controller';
import { PharmacyStockTransferService } from './pharmacy.stock-transfer.service';
import { PharmacyDashboardController } from './pharmacy.dashboard.controller';
import { PharmacyDashboardService } from './pharmacy.dashboard.service';
import { PharmacyMedicationRequestController } from './pharmacy.medication-request.controller';
import { MedicationRequestModule } from '../medication-request/medication-request.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PatientMedicationsModule } from '../patient-medications/patient-medications.module';
import { DrugStockModule } from './drug-stock.module';
import { PharmacyRefillRequestController } from './pharmacy.refill-request.controller';
import { PharmacyRefillRequestService } from './pharmacy.refill-request.service';
import { PharmacyHeadDashboardService } from './pharmacy-head-dashboard.service';
import { PharmacyReportsController } from './pharmacy.reports.controller';
import { PharmacyReportsService } from './pharmacy-reports.service';

@Module({
  imports: [
    PrismaModule,
    DrugStockModule,
    MedicationRequestModule,
    InvoiceModule,
    PatientMedicationsModule,
  ],
  controllers: [
    PharmacyDrugController,
    PharmacyDrugPriceController,
    PharmacyBatchController,
    PharmacyManufacturerController,
    PharmacySupplierController,
    PharmacyLocationController,
    PharmacyDrugInteractionController,
    PharmacyPurchaseOrderController,
    PharmacyGoodsReceiptController,
    PharmacyStockTransferController,
    PharmacyDashboardController,
    PharmacyMedicationRequestController,
    PharmacyRefillRequestController,
    PharmacyReportsController,
  ],
  providers: [
    PharmacyDrugService,
    PharmacyDrugPriceService,
    PharmacyBatchService,
    PharmacyManufacturerService,
    PharmacySupplierService,
    PharmacyLocationService,
    PharmacyDrugInteractionService,
    PharmacyPurchaseOrderService,
    PharmacyGoodsReceiptService,
    PharmacyStockTransferService,
    PharmacyDashboardService,
    PharmacyRefillRequestService,
    PharmacyHeadDashboardService,
    PharmacyReportsService,
  ],
  exports: [
    DrugStockModule,
    PharmacyDrugService,
    PharmacyDrugPriceService,
    PharmacyBatchService,
    PharmacyManufacturerService,
    PharmacySupplierService,
    PharmacyLocationService,
    PharmacyDrugInteractionService,
    PharmacyPurchaseOrderService,
    PharmacyGoodsReceiptService,
    PharmacyStockTransferService,
    PharmacyDashboardService,
  ],
})
export class PharmacyModule {}
