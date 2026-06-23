import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { InvoiceService } from './invoice.service';

const CONSOLIDATION_ENABLED =
  process.env.INVOICE_CONSOLIDATION_ENABLED?.trim().toLowerCase() !== 'false';

@Injectable()
export class InvoiceConsolidationScheduler {
  private readonly logger = new Logger(InvoiceConsolidationScheduler.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /** Runs daily at 23:59 in the hospital timezone. */
  @Cron('59 23 * * *', {
    name: 'consolidate-pending-invoices',
    timeZone: HOSPITAL_TIMEZONE,
  })
  async handleConsolidatePendingInvoices(): Promise<void> {
    if (!CONSOLIDATION_ENABLED) {
      return;
    }

    this.logger.log('Starting nightly pending invoice consolidation');
    try {
      const result = await this.invoiceService.consolidatePendingInvoices();
      this.logger.log(
        `Pending invoice consolidation finished: ${result.patientsProcessed} patient(s), ` +
          `${result.invoicesMerged} merged, ${result.invoicesDeleted} deleted, ` +
          `${result.sourcesSkipped} source(s) skipped`,
      );
    } catch (err) {
      this.logger.error(
        `Pending invoice consolidation job failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
