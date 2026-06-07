import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { InvoicePurchaseService } from './invoice-purchase.service';
import { ReturnPurchaseInvoiceItemDto } from './dto/invoice.dto';

@ApiTags('Invoice Purchases')
@Controller('invoice-purchases')
@UseGuards(JwtAuthGuard, AccessGuard)
export class InvoicePurchaseController {
  constructor(private readonly service: InvoicePurchaseService) {}

  @Post(':invoiceId/items/:itemId/return')
  @ApiOperation({
    summary:
      'Return quantity on a purchase item invoice line (restocks FIFO, recalculates totals)',
    description:
      'Only allowed when the line has no payments or allocations and the invoice is not PAID.',
  })
  returnItem(
    @Param('invoiceId') invoiceId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReturnPurchaseInvoiceItemDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.returnPurchaseInvoiceItem(
      invoiceId,
      itemId,
      dto,
      req.user.sub,
    );
  }
}
