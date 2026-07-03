import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PHARMACY_HEAD_ACCESS } from './pharmacy.constants';
import {
  PharmacyInventoryValuationBatchesQueryDto,
  PharmacyInventoryValuationQueryDto,
  PharmacySalesBreakdownDetailsQueryDto,
  PharmacySalesBreakdownQueryDto,
} from './dto/pharmacy-reports-query.dto';
import { PharmacyReportsService } from './pharmacy-reports.service';

@ApiTags('Pharmacy - Reports')
@Controller('pharmacy/reports')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PHARMACY_HEAD_ACCESS)
export class PharmacyReportsController {
  constructor(private readonly service: PharmacyReportsService) {}

  @Get('sales-breakdown')
  @ApiOperation({ summary: 'Sales breakdown grouped with profit (pharmacy head)' })
  salesBreakdown(@Query() query: PharmacySalesBreakdownQueryDto) {
    return this.service.getSalesBreakdown(query);
  }

  @Get('sales-breakdown/details')
  @ApiOperation({
    summary: 'Paginated FIFO sale line details for a breakdown group',
  })
  salesBreakdownDetails(@Query() query: PharmacySalesBreakdownDetailsQueryDto) {
    return this.service.getSalesBreakdownDetails(query);
  }

  @Get('inventory-valuation')
  @ApiOperation({ summary: 'Inventory valuation by store (pharmacy head)' })
  inventoryValuation(@Query() query: PharmacyInventoryValuationQueryDto) {
    return this.service.getInventoryValuation(query);
  }

  @Get('inventory-valuation/batches')
  @ApiOperation({ summary: 'Paginated batch-level inventory valuation detail' })
  inventoryValuationBatches(
    @Query() query: PharmacyInventoryValuationBatchesQueryDto,
  ) {
    return this.service.getInventoryValuationBatches(query);
  }
}
