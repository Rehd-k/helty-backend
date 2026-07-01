import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS, ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsReportsService } from './accounts-reports.service';
import {
  AccountsAgingQueryDto,
  AccountsDateRangeQueryDto,
  AccountsPeriodQueryDto,
  AccountsRevenueByServiceDetailsQueryDto,
} from './dto/accounts-query.dto';

@ApiTags('Accounts - Reports')
@Controller('accounts/reports')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsReportsController {
  constructor(private readonly service: AccountsReportsService) {}

  @Get('daily-collections')
  @ApiOperation({ summary: 'Daily collections by payment method' })
  dailyCollections(@Query() q: AccountsDateRangeQueryDto) {
    return this.service.dailyCollections(q);
  }

  @Get('aging')
  @ApiOperation({ summary: 'HMO/discount receivables aging' })
  aging(@Query() q: AccountsAgingQueryDto) {
    return this.service.aging(q);
  }

  @Get('collection-efficiency')
  @ApiOperation({ summary: 'Collection efficiency metrics' })
  collectionEfficiency(@Query() q: AccountsPeriodQueryDto) {
    return this.service.collectionEfficiency(q);
  }

  @Get('revenue-by-service/details')
  @ApiOperation({
    summary: 'Revenue by service category — payment drill-down',
    description:
      'Paginated list of patient payments for a service category row from revenue-by-service. Pass the same period and asOf as the summary.',
  })
  revenueByServiceDetails(@Query() q: AccountsRevenueByServiceDetailsQueryDto) {
    return this.service.revenueByServiceDetails(q);
  }

  @Get('revenue-by-service')
  @ApiOperation({ summary: 'Revenue breakdown by service category' })
  revenueByService(@Query() q: AccountsPeriodQueryDto) {
    return this.service.revenueByService(q);
  }

  @Get('profit-loss')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Profit and loss statement (account head)' })
  profitLoss(@Query() q: AccountsPeriodQueryDto) {
    return this.service.profitLoss(q);
  }

  @Get('cash-flow')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Cash flow statement (account head)' })
  cashFlow(@Query() q: AccountsPeriodQueryDto) {
    return this.service.cashFlow(q);
  }

  @Get('expense-vs-budget')
  @ApiOperation({ summary: 'Expense vs budget variance' })
  expenseVsBudget(@Query() q: AccountsPeriodQueryDto) {
    return this.service.expenseVsBudget(q);
  }

  @Get('period-comparison')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Period-over-period comparison (account head)' })
  periodComparison(@Query() q: AccountsPeriodQueryDto) {
    return this.service.periodComparison(q);
  }
}
