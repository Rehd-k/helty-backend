import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS, ACCOUNTING_ACCESS } from './accounts.constants';
import {
  AccountsApprovalsService,
  AccountsPeriodsService,
} from './accounts-approvals.service';
import {
  CreateFinanceApprovalDto,
  RejectApprovalDto,
  ReviewApprovalDto,
} from './dto/accounts-body.dto';

@ApiTags('Accounts - Approvals')
@Controller('accounts/approvals')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNT_HEAD_ACCESS)
export class AccountsApprovalsController {
  constructor(private readonly service: AccountsApprovalsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Pending finance approvals' })
  pending() {
    return this.service.listPending();
  }

  @Post()
  @AccountTypes(...ACCOUNTING_ACCESS)
  @ApiOperation({ summary: 'Submit a finance approval request' })
  create(
    @Body() dto: CreateFinanceApprovalDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.service.create(dto, req.user?.sub ?? '');
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a finance request' })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewApprovalDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.approve(id, dto, req.user?.sub ?? '', req.user?.staffRole);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a finance request' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectApprovalDto,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.reject(id, dto, req.user?.sub ?? '', req.user?.staffRole);
  }
}

@ApiTags('Accounts - Periods')
@Controller('accounts/periods')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsPeriodsController {
  constructor(private readonly service: AccountsPeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'List fiscal periods' })
  list() {
    return this.service.listPeriods();
  }

  @Post(':id/close')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Close fiscal period (account head)' })
  close(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.closePeriod(id, req.user?.sub ?? '', req.user?.staffRole);
  }
}
