import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators/account-types.decorator';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { CreateInvoiceItemRefundRequestDto } from './dto/invoice.dto';
import { InvoiceItemRefundService } from './invoice-item-refund.service';

const REFUND_REQUEST_ACCESS = [
  'BILLING',
  'BILLS',
  'ACCOUNTING',
  'ACCOUNTS',
  'SUPER_ADMIN',
] as const;

@ApiTags('Invoices - Refunds')
@Controller('invoices')
@UseGuards(JwtAuthGuard, AccessGuard)
export class InvoiceItemRefundController {
  constructor(private readonly service: InvoiceItemRefundService) {}

  @Post(':invoiceId/items/:itemId/refund-requests')
  @AccountTypes(...REFUND_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Submit an invoice line refund request' })
  submit(
    @Param('invoiceId') invoiceId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateInvoiceItemRefundRequestDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.service.submit(
      invoiceId,
      itemId,
      dto.reason,
      req.user?.sub ?? '',
    );
  }

  @Get(':invoiceId/refund-requests')
  @AccountTypes(...REFUND_REQUEST_ACCESS)
  @ApiOperation({ summary: 'List refund requests for an invoice' })
  listForInvoice(@Param('invoiceId') invoiceId: string) {
    return this.service.listForInvoice(invoiceId);
  }

  @Delete(':invoiceId/items/:itemId/refund-requests/:requestId')
  @AccountTypes(...REFUND_REQUEST_ACCESS)
  @ApiOperation({ summary: 'Cancel a pending refund request' })
  cancel(
    @Param('invoiceId') invoiceId: string,
    @Param('itemId') itemId: string,
    @Param('requestId') requestId: string,
    @Req() req: { user?: { sub?: string; staffRole?: string } },
  ) {
    return this.service.cancel(
      invoiceId,
      itemId,
      requestId,
      req.user?.sub ?? '',
      req.user?.staffRole,
    );
  }
}
