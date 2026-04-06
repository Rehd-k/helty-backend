import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { InvoiceDrugService } from './invoice-drug.service';
import { UpdateInvoiceDto, UpdateInvoiceItemDto } from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

@ApiTags('Invoice Drugs')
@Controller('invoice-drugs')
export class InvoiceDrugController {
  constructor(private readonly invoiceDrugService: InvoiceDrugService) { }

  @Get()
  @ApiOperation({
    summary: 'List all invoices with drug items (paginated)',
    description:
      'Returns a paginated list of invoices that contain drug items, ordered most-recent first.',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Records to skip',
    example: 0,
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Records to return',
    example: 20,
  })
  @ApiOkResponse({ description: 'Paginated list of drug invoices' })
  findAll(
    @Query()
    params: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
    },
  ) {
    return this.invoiceDrugService.findAllDrugInvoices(params);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single drug invoice by ID',
    description:
      'Returns the full invoice detail if it contains drug items, including all line items, associated service/drug snapshots, patient details, staff info, and a computed `totalAmount`.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOkResponse({ description: 'Invoice detail with computed totalAmount' })
  @ApiNotFoundResponse({ description: 'Invoice not found or does not contain drug items' })
  findOne(@Param('id') id: string) {
    return this.invoiceDrugService.findOneDrugInvoice(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a drug invoice',
    description:
      'Update invoice status (e.g. DRAFT → ACTIVE → PAID) or associated staff for invoices that contain drug items. The authenticated user is recorded as `updatedBy`.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOkResponse({ description: 'Invoice updated successfully' })
  @ApiNotFoundResponse({ description: 'Invoice not found or does not contain drug items' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: any,
  ) {
    return this.invoiceDrugService.updateDrugInvoice(id, dto, req);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a drug invoice',
    description:
      'Permanently deletes an invoice that contains drug items. **Fails** if the invoice still has line items — remove all items first.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiNoContentResponse({ description: 'Invoice deleted' })
  @ApiNotFoundResponse({ description: 'Invoice not found or does not contain drug items' })
  @ApiBadRequestResponse({ description: 'Invoice still has line items' })
  remove(@Param('id') id: string) {
    return this.invoiceDrugService.removeDrugInvoice(id);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({
    summary: 'Update an invoice line item in a drug invoice',
    description:
      'Update the quantity or price snapshot for a specific line item on an invoice that contains drug items.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID' })
  @ApiOkResponse({ description: 'Line item updated' })
  @ApiNotFoundResponse({ description: 'Invoice or InvoiceItem not found, or invoice does not contain drug items' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInvoiceItemDto,
  ) {
    console.log(dto)
    return this.invoiceDrugService.updateDrugInvoiceItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a line item from a drug invoice',
    description: 'Permanently removes a line item from an invoice that contains drug items.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID' })
  @ApiNoContentResponse({ description: 'Line item removed' })
  @ApiNotFoundResponse({ description: 'Invoice or InvoiceItem not found, or invoice does not contain drug items' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.invoiceDrugService.removeDrugInvoiceItem(id, itemId);
  }
}