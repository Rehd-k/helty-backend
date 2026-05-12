import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { StoreConsumableController } from './store-consumable.controller';
import { StoreConsumableUsageController } from './store-consumable-usage.controller';
import { StoreConsumableService } from './store-consumable.service';
import { ConsumableStockService } from './consumable-stock.service';
import { ConsumableUsageService } from './consumable-usage.service';
import { ConsumableAnalyticsService } from './consumable-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    StoreController,
    StoreConsumableController,
    StoreConsumableUsageController,
  ],
  providers: [
    StoreService,
    StoreConsumableService,
    ConsumableStockService,
    ConsumableUsageService,
    ConsumableAnalyticsService,
  ],
  exports: [
    StoreService,
    StoreConsumableService,
    ConsumableStockService,
    ConsumableUsageService,
    ConsumableAnalyticsService,
  ],
})
export class StoreModule {}
