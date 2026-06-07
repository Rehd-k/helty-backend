import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsWalletsService } from './accounts-wallets.service';

@ApiTags('Accounts - Wallets')
@Controller('accounts/wallets')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsWalletsController {
  constructor(private readonly service: AccountsWalletsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Patient wallet float summary' })
  summary() {
    return this.service.summary();
  }
}
