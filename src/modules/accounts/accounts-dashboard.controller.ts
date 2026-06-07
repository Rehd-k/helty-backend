import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsDashboardService } from './accounts-dashboard.service';
import { AccountsPeriodQueryDto } from './dto/accounts-query.dto';

@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsDashboardController {
  constructor(private readonly service: AccountsDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Unified KPI bundle for accounts dashboard' })
  dashboard(@Query() q: AccountsPeriodQueryDto, @Req() req: { user?: { staffRole?: string } }) {
    return this.service.getDashboard(q, req.user?.staffRole);
  }
}
