import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesDashboardService } from './purchases.dashboard.service';
import { PurchasesDashboardQueryDto, PurchasesUsageHistoryQueryDto } from './dto/dashboard.dto';

@ApiTags('Purchases - Dashboard')
@Controller('purchases/dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesDashboardController {
  constructor(private readonly service: PurchasesDashboardService) {}

  @Get('summary')
  summary(@Query() query: PurchasesDashboardQueryDto) {
    return this.service.getSummary(query);
  }

  @Get('orders-status')
  ordersStatus(@Query() query: PurchasesDashboardQueryDto) {
    return this.service.getOrdersStatus(query);
  }

  @Get('top-items')
  @ApiOperation({ summary: 'Top purchased items' })
  topItems(@Query() query: PurchasesDashboardQueryDto) {
    return this.service.getTopItems(query);
  }

  @Get('charts/purchase-value')
  purchaseValue(@Query() query: PurchasesDashboardQueryDto) {
    return this.service.getPurchaseValueChart(query);
  }

  @Get('supplier-performance')
  supplierPerformance(@Query() query: PurchasesDashboardQueryDto) {
    return this.service.getSupplierPerformance(query);
  }

  @Get('usage-history')
  @ApiOperation({ summary: 'Purchase item usage history from invoice lines' })
  usageHistory(@Query() query: PurchasesUsageHistoryQueryDto) {
    return this.service.getUsageHistory(query);
  }
}
