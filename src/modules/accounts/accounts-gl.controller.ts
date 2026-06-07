import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS, ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsGlService } from './accounts-gl.service';
import {
  CreateChartOfAccountDto,
  CreateJournalEntryDto,
  UpdateChartOfAccountDto,
} from './dto/accounts-body.dto';
import { AccountsDateRangeQueryDto } from './dto/accounts-query.dto';

@ApiTags('Accounts - General Ledger')
@Controller('accounts')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNT_HEAD_ACCESS)
export class AccountsGlController {
  constructor(private readonly service: AccountsGlService) {}

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries' })
  listJournalEntries(@Query() q: AccountsDateRangeQueryDto) {
    return this.service.listJournalEntries(q);
  }

  @Post('journal-entries')
  @ApiOperation({ summary: 'Post a journal entry' })
  createJournalEntry(
    @Body() dto: CreateJournalEntryDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.createJournalEntry(
      dto,
      req.user?.sub ?? '',
      req.user?.staffRole,
    );
  }

  @Get('chart-of-accounts')
  @AccountTypes(...ACCOUNTING_ACCESS)
  @ApiOperation({ summary: 'Chart of accounts' })
  listChartOfAccounts() {
    return this.service.listChartOfAccounts();
  }

  @Post('chart-of-accounts')
  @ApiOperation({ summary: 'Create chart of account' })
  createChartOfAccount(
    @Body() dto: CreateChartOfAccountDto,
    @Req() req: { user?: { staffRole?: string } },
  ) {
    return this.service.createChartOfAccount(dto, req.user?.staffRole);
  }

  @Patch('chart-of-accounts/:id')
  @ApiOperation({ summary: 'Update chart of account' })
  updateChartOfAccount(
    @Param('id') id: string,
    @Body() dto: UpdateChartOfAccountDto,
    @Req() req: { user?: { staffRole?: string } },
  ) {
    return this.service.updateChartOfAccount(id, dto, req.user?.staffRole);
  }
}
