import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
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
  ApiBody,
} from '@nestjs/swagger';
import { InvoiceDrugService } from './invoice-drug.service';
import {
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
  SubstituteDrugInvoiceItemDto,
  ReturnDrugInvoiceItemDto,
} from './dto/invoice.dto';
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
    return this.invoiceDrugService.updateDrugInvoiceItem(id, itemId, dto);
  }

  @Post(':id/items/:itemId/substitute')
  @ApiOperation({
    summary: 'Substitute the drug on an invoice line (atomic)',
    description:
      'Replaces the drug on an existing drug line in a single transaction by updating the same line item (same id), then recalculating invoice totals. If the invoice has an `encounterId`, matching medication orders for that encounter and the previous drug are updated to the new drug. Does not delete the line, so partial line payments and usage segments stay attached. Blocked for settled lines and paid invoices.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID (must be a drug line)' })
  @ApiOkResponse({ description: 'Line item updated with the new drug' })
  @ApiNotFoundResponse({
    description: 'Invoice or drug line not found, or invoice has no drug items',
  })
  @ApiBadRequestResponse({
    description: 'Paid invoice, settled line, same drug, or validation error',
  })
  substituteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SubstituteDrugInvoiceItemDto,
  ) {
    return this.invoiceDrugService.substituteDrugInvoiceItem(id, itemId, dto);
  }

  @Post(':id/items/:itemId/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return drug units on an invoice line',
    description:
      'Returns unpaid drug line quantity: reduces or removes the line, recalculates the invoice, persists an `InvoiceDrugReturn`, and restocks settled lines into the first pharmacy location whose name contains "dispensary".',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID (drug line)' })
  @ApiBody({ type: ReturnDrugInvoiceItemDto })
  @ApiOkResponse({ description: 'Return recorded; invoice snapshot included' })
  @ApiBadRequestResponse({
    description:
      'Paid invoice, paid line, quantity too high, recurring line, or no dispensary location',
  })
  returnDrugItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReturnDrugInvoiceItemDto,
    @Req() req: { user?: { sub: string } },
  ) {
    const staffId = req.user?.sub;
    if (!staffId) {
      throw new UnauthorizedException(
        'Authenticated staff id required for drug return',
      );
    }
    return this.invoiceDrugService.returnDrugInvoiceItem(
      id,
      itemId,
      dto,
      staffId,
    );
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