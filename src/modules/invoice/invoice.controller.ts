import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import {
  AddInvoiceItemDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
} from './dto/invoice.dto';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) { }

  // ─── Invoice Endpoints ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new invoice for a patient',
    description:
      'Creates an invoice for a patient. Add services as line items separately via `POST /invoices/:id/items`. The authenticated staff member is recorded as `createdBy`.',
  })
  @ApiCreatedResponse({ description: 'Invoice created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error in request body' })
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoiceService.create(dto, req);
  }

  @Get()
  @ApiOperation({
    summary: 'List all invoices (paginated)',
    description: 'Returns a paginated list of all invoices ordered most-recent first.',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Records to skip', example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Records to return', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of invoices' })
  findAll(
    @Query('skip') skip = '0',
    @Query('take') take = '20',
  ) {
    return this.invoiceService.findAll(+skip, +take);
  }

  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'Get all invoices for a specific patient',
    description: 'Returns every invoice for the given patient, including all line items and service info.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'List of patient invoices' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.invoiceService.findByPatient(patientId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single invoice by ID',
    description:
      'Returns the full invoice detail including all line items, associated service snapshots, patient details, staff info, and a computed `totalAmount`.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOkResponse({ description: 'Invoice detail with computed totalAmount' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  findOne(@Param('id') id: string) {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an invoice',
    description:
      'Update invoice status (e.g. DRAFT → ACTIVE → PAID) or associated staff. The authenticated user is recorded as `updatedBy`.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOkResponse({ description: 'Invoice updated successfully' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: any,
  ) {
    return this.invoiceService.update(id, dto, req);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an invoice',
    description:
      'Permanently deletes an invoice. **Fails** if the invoice still has line items — remove all items first.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiNoContentResponse({ description: 'Invoice deleted' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  @ApiBadRequestResponse({ description: 'Invoice still has line items' })
  remove(@Param('id') id: string) {
    return this.invoiceService.remove(id);
  }

  // ─── InvoiceItem Endpoints ────────────────────────────────────────────────────

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a service to an invoice as a line item',
    description:
      'Adds a service to the invoice. `priceAtTime` captures the cost snapshot at the moment of invoicing, so future price changes on the service do not affect existing invoices.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiCreatedResponse({ description: 'Line item added' })
  @ApiNotFoundResponse({ description: 'Invoice or Service not found' })
  addItem(@Param('id') id: string, @Body() dto: AddInvoiceItemDto) {
    return this.invoiceService.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({
    summary: 'Update an invoice line item',
    description: 'Update the quantity or price snapshot for a specific line item on an invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID' })
  @ApiOkResponse({ description: 'Line item updated' })
  @ApiNotFoundResponse({ description: 'Invoice or InvoiceItem not found' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInvoiceItemDto,
  ) {
    return this.invoiceService.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a line item from an invoice',
    description: 'Permanently removes a service line item from the invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'itemId', description: 'InvoiceItem UUID' })
  @ApiNoContentResponse({ description: 'Line item removed' })
  @ApiNotFoundResponse({ description: 'Invoice or InvoiceItem not found' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.invoiceService.removeItem(id, itemId);
  }
}
