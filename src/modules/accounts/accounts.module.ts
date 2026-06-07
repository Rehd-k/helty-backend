import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingAnalyticsModule } from '../billing-analytics/billing-analytics.module';
import { InvoiceModule } from '../invoice/invoice.module';
import {
  AccountsApprovalsController,
  AccountsPeriodsController,
} from './accounts-approvals.controller';
import {
  AccountsApprovalsService,
  AccountsPeriodsService,
} from './accounts-approvals.service';
import { AccountsAuditController } from './accounts-audit.controller';
import { AccountsAuditService } from './accounts-audit.service';
import { AccountsDashboardController } from './accounts-dashboard.controller';
import { AccountsDashboardService } from './accounts-dashboard.service';
import { AccountsGlController } from './accounts-gl.controller';
import { AccountsGlService } from './accounts-gl.service';
import { AccountsReconciliationController } from './accounts-reconciliation.controller';
import { AccountsReconciliationService } from './accounts-reconciliation.service';
import { AccountsReportsController } from './accounts-reports.controller';
import { AccountsReportsService } from './accounts-reports.service';
import { AccountsWalletsController } from './accounts-wallets.controller';
import { AccountsWalletsService } from './accounts-wallets.service';
import { AccountsRefundRequestsController } from './accounts-refund-requests.controller';

@Module({
  imports: [PrismaModule, BillingAnalyticsModule, InvoiceModule],
  controllers: [
    AccountsDashboardController,
    AccountsAuditController,
    AccountsReportsController,
    AccountsWalletsController,
    AccountsReconciliationController,
    AccountsApprovalsController,
    AccountsPeriodsController,
    AccountsGlController,
    AccountsRefundRequestsController,
  ],
  providers: [
    AccountsDashboardService,
    AccountsAuditService,
    AccountsReportsService,
    AccountsWalletsService,
    AccountsReconciliationService,
    AccountsApprovalsService,
    AccountsPeriodsService,
    AccountsGlService,
  ],
  exports: [
    AccountsDashboardService,
    AccountsAuditService,
    AccountsReportsService,
  ],
})
export class AccountsModule {}
