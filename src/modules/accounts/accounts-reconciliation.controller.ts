import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS, ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsReconciliationService } from './accounts-reconciliation.service';
import {
  CreateBankReconciliationDto,
  SubmitDailyCashDto,
} from './dto/accounts-body.dto';

@ApiTags('Accounts - Reconciliation')
@Controller('accounts/reconciliation')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsReconciliationController {
  constructor(private readonly service: AccountsReconciliationService) {}

  @Get('daily-cash')
  @ApiOperation({ summary: 'Daily cash reconciliation history' })
  listDailyCash() {
    return this.service.listDailyCash();
  }

  @Post('daily-cash')
  @ApiOperation({ summary: 'Submit daily cash count' })
  submitDailyCash(
    @Body() dto: SubmitDailyCashDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.submitDailyCash(
      dto,
      req.user?.sub ?? '',
      req.user?.staffRole,
    );
  }

  @Get('bank')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Bank reconciliation list (account head)' })
  listBank() {
    return this.service.listBankRecon();
  }

  @Post('bank')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Create bank reconciliation (account head)' })
  createBank(
    @Body() dto: CreateBankReconciliationDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.createBankRecon(
      dto,
      req.user?.sub ?? '',
      req.user?.staffRole,
    );
  }
}
