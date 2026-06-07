import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { ACCOUNT_HEAD_ACCESS, ACCOUNTING_ACCESS } from './accounts.constants';
import { AccountsAuditService } from './accounts-audit.service';
import {
  AccountsAuditLogsQueryDto,
  AccountsInvoiceChangesQueryDto,
  AccountsPeriodQueryDto,
} from './dto/accounts-query.dto';
import { AcknowledgeComplianceDto } from './dto/accounts-body.dto';

@ApiTags('Accounts - Audit')
@Controller('accounts/audit')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...ACCOUNTING_ACCESS)
export class AccountsAuditController {
  constructor(private readonly service: AccountsAuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Finance-scoped audit logs' })
  logs(@Query() q: AccountsAuditLogsQueryDto) {
    return this.service.auditLogs(q);
  }

  @Get('compliance-checklist')
  @ApiOperation({ summary: 'Finance compliance checklist' })
  compliance(@Req() req: { user?: { staffRole?: string } }) {
    return this.service.complianceChecklist(req.user?.staffRole);
  }

  @Patch('compliance-checklist/:code')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Acknowledge compliance item (account head)' })
  acknowledge(
    @Param('code') code: string,
    @Body() dto: AcknowledgeComplianceDto,
    @Req() req: { user?: { staffRole?: string } },
  ) {
    return this.service.acknowledgeCompliance(code, dto, req.user?.staffRole);
  }

  @Get('invoice-changes')
  @ApiOperation({ summary: 'Invoice line change history' })
  invoiceChanges(@Query() q: AccountsInvoiceChangesQueryDto) {
    return this.service.invoiceChanges(q);
  }

  @Get('leak-detection')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Revenue leak detection (account head)' })
  leakDetection() {
    return this.service.leakDetection();
  }

  @Get('staff-activity')
  @AccountTypes(...ACCOUNT_HEAD_ACCESS)
  @ApiOperation({ summary: 'Staff finance activity (account head)' })
  staffActivity(@Query() q: AccountsPeriodQueryDto) {
    return this.service.staffActivity(q);
  }
}
