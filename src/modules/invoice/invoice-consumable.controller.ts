import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { InvoiceConsumableService } from './invoice-consumable.service';
import { ReturnConsumableInvoiceItemDto } from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

@ApiTags('Invoice Consumables')
@Controller('invoice-consumables')
@UseGuards(JwtAuthGuard, AccessGuard)
export class InvoiceConsumableController {
  constructor(private readonly service: InvoiceConsumableService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices that contain consumable line items' })
  findAll(
    @Query()
    query: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
    },
  ) {
    return this.service.findAllConsumableInvoices(query);
  }

  @Post(':invoiceId/items/:itemId/return')
  @ApiOperation({
    summary: 'Return quantity on a consumable invoice line (restocks FIFO, recalculates totals)',
  })
  returnItem(
    @Param('invoiceId') invoiceId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReturnConsumableInvoiceItemDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.returnConsumableInvoiceItem(
      invoiceId,
      itemId,
      dto,
      req.user.sub,
    );
  }
}
