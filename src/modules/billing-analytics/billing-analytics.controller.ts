import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BillingAnalyticsService } from './billing-analytics.service';
import {
  BillingAnalyticsQueryDto,
  RecentInvoicesQueryDto,
} from './dto/billing-analytics.dto';

@ApiTags('Billing analytics')
@Controller('billing/analytics')
export class BillingAnalyticsController {
  constructor(private readonly billingAnalytics: BillingAnalyticsService) {}

  @Get('revenue-summary')
  @ApiOperation({
    summary: 'Revenue vs previous period',
    description:
      'Cash in: sum of InvoicePayment (createdAt) plus TransactionPayment (paidAt) for the current period vs the previous period (today/yesterday, week/last week, etc.).',
  })
  @ApiOkResponse({ description: 'Revenue comparison' })
  revenueSummary(@Query() q: BillingAnalyticsQueryDto) {
    return this.billingAnalytics.revenueSummary(q.period, q.asOf);
  }

  @Get('unpaid-summary')
  @ApiOperation({
    summary: 'Unpaid invoice flow (open bills created in period)',
    description:
      'Aggregates line items on PENDING/PARTIALLY_PAID invoices whose invoice createdAt falls in each window. Includes openStock snapshot for all open invoices.',
  })
  unpaidSummary(@Query() q: BillingAnalyticsQueryDto) {
    return this.billingAnalytics.unpaidSummary(q.period, q.asOf);
  }

  @Get('overdue-summary')
  @ApiOperation({
    summary: 'Overdue bills (>30 days since invoice creation) and trend',
  })
  overdueSummary(@Query() q: BillingAnalyticsQueryDto) {
    return this.billingAnalytics.overdueSummary(q.period, q.asOf);
  }

  @Get('revenue-series')
  @ApiOperation({
    summary: 'Revenue buckets for line chart (fl_chart)',
    description:
      'Buckets depend on period: today=6×4h, week=7 days, month=4 day-ranges, quarter=3 months, year=6×2 months.',
  })
  revenueSeries(@Query() q: BillingAnalyticsQueryDto) {
    return this.billingAnalytics.revenueSeries(q.period, q.asOf);
  }

  @Get('revenue-by-department')
  @ApiOperation({
    summary: 'Revenue by department (invoice lines only)',
    description:
      'InvoiceItemPayment allocations in period plus proportional split of InvoicePayment by line totals.',
  })
  revenueByDepartment(@Query() q: BillingAnalyticsQueryDto) {
    return this.billingAnalytics.revenueByDepartment(q.period, q.asOf);
  }

  @Get('recent-invoices')
  @ApiOperation({
    summary: 'Recent invoices for dashboard table',
  })
  recentInvoices(@Query() q: RecentInvoicesQueryDto) {
    return this.billingAnalytics.recentInvoices(
      q.period,
      q.asOf,
      q.take ?? 20,
    );
  }
}
