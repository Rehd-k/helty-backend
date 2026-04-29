import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyDashboardService } from './pharmacy.dashboard.service';
import {
  PharmacyDashboardChartQueryDto,
  PharmacyDashboardQueryDto,
  PharmacyDrugUsageChartQueryDto,
} from './dto/pharmacy-dashboard-query.dto';

@ApiTags('Pharmacy - Dashboard')
@Controller('pharmacy/dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyDashboardController {
  constructor(private readonly service: PharmacyDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Pharmacy dashboard summary KPIs' })
  summary(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getSummary(query);
  }

  @Get('orders-status')
  @ApiOperation({ summary: 'Prescription/order status breakdown' })
  ordersStatus(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getOrdersStatus(query);
  }

  @Get('top-selling')
  @ApiOperation({ summary: 'Top-selling medications by quantity and revenue' })
  topSelling(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getTopSelling(query);
  }

  @Get('most-prescribed')
  @ApiOperation({ summary: 'Most-prescribed medications ranking' })
  mostPrescribed(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getMostPrescribed(query);
  }

  @Get('stock-movement')
  @ApiOperation({ summary: 'Stock movement aggregate in selected period' })
  stockMovement(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getStockMovement(query);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Supplier and purchase order status widget data' })
  purchaseOrders(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getPurchaseOrders(query);
  }

  @Get('insurance-claims')
  @ApiOperation({ summary: 'Insurance claims summary and trend data' })
  insuranceClaims(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getInsuranceClaims(query);
  }

  @Get('pharmacist-productivity')
  @ApiOperation({ summary: 'Pharmacist productivity metrics' })
  pharmacistProductivity(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getPharmacistProductivity(query);
  }

  @Get('interaction-alerts')
  @ApiOperation({ summary: 'Drug interaction and allergy alerts overview' })
  interactionAlerts(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getInteractionAlerts(query);
  }

  @Get('controlled-substances')
  @ApiOperation({ summary: 'Controlled substance logs and compliance metrics' })
  controlledSubstances(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getControlledSubstances(query);
  }

  @Get('charts/revenue')
  @ApiOperation({ summary: 'Revenue chart points for dashboard' })
  revenueChart(@Query() query: PharmacyDashboardChartQueryDto) {
    return this.service.getRevenueChart(query);
  }

  @Get('charts/drug-usage')
  @ApiOperation({ summary: 'Drug usage trend chart by medication series' })
  drugUsageChart(@Query() query: PharmacyDrugUsageChartQueryDto) {
    return this.service.getDrugUsageChart(query);
  }

  @Get('charts/inventory')
  @ApiOperation({ summary: 'Inventory trend chart points' })
  inventoryChart(@Query() query: PharmacyDashboardChartQueryDto) {
    return this.service.getInventoryTrendChart(query);
  }

  @Get('dispense-history')
  @ApiOperation({
    summary:
      'Dispense history from settled invoice drug items with date and drug filters',
  })
  dispenseHistory(@Query() query: PharmacyDashboardQueryDto) {
    return this.service.getDispenseHistory(query);
  }
}
