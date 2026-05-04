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
import { InvoicePaymentMethod, InvoicePaymentSource } from '@prisma/client';
import { InvoiceService } from './invoice.service';
import {
  AddInvoiceItemDto,
  AllocateInvoiceItemPaymentDto,
  CreateInvoiceInsuranceClaimDto,
  CreateInvoiceDto,
  RecordInvoicePaymentDto,
  UpdateInvoiceInsuranceClaimDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
  WalletDepositDto,
  ListInvoicesByCategoryQueryDto,
  SplitInvoiceDto,
} from './dto/invoice.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // ─── Invoice Endpoints ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new invoice for a patient',
    description:
      'Creates an invoice for a patient, unless they already have a PENDING or PARTIALLY_PAID invoice — in that case that invoice is updated (staff/encounter) and returned. After a bill is PAID, the next call creates a new invoice. Add services as line items via `POST /invoices/:id/items`. The authenticated staff member is recorded as `createdBy` on new invoices, or `updatedBy` when reusing an open invoice.',
  })
  @ApiCreatedResponse({ description: 'Invoice created successfully' })
  @ApiBadRequestResponse({ description: 'Validation error in request body' })
  create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.invoiceService.create(dto, req);
  }

  @Get()
  @ApiOperation({
    summary: 'List all invoices (paginated)',
    description:
      'Returns a paginated list of all invoices ordered most-recent first.',
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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'],
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'patientId',
    required: false,
    type: String,
    description:
      'Patient primary key UUID (`Patient.id`). When set, only that patient’s invoices are returned (still scoped by date range, allowIP, and optional search).',
  })
  @ApiOkResponse({ description: 'Paginated list of invoices' })
  findAll(
    @Query()
    params: DateRangeSkipTakeDto & {
      search?: string;
      category?: string;
      query?: string;
      allowIP: boolean;
      status?: string;
      /** Patient UUID (`Patient.id`); narrows the list to that patient’s invoices */
      patientId?: string;
    },
  ) {
    return this.invoiceService.findAll(params);
  }

  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'Get all invoices for a specific patient',
    description:
      'Returns every invoice for the given patient, including all line items and service info.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  @ApiOkResponse({ description: 'List of patient invoices' })
  findByPatient(@Param('patientId') patientId: string) {
    return this.invoiceService.findByPatient(patientId);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'List all invoice payments (cashier/head of accounts view)',
    description:
      'Returns all invoice payments within date range and a staff-level summary of who processed payments.',
  })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: InvoicePaymentSource,
    description: 'Filter by payment source (e.g. CASH, WALLET)',
  })
  @ApiQuery({
    name: 'method',
    required: false,
    enum: InvoicePaymentMethod,
    description: 'Filter by payment method (CASH, CARD, TRANSFER, etc.)',
  })
  @ApiQuery({
    name: 'processedById',
    required: false,
    description: 'Filter by staff UUID that received payment',
  })
  listAllPayments(
    @Query()
    query: DateRangeSkipTakeDto & {
      source?: InvoicePaymentSource;
      paymentMethod?: InvoicePaymentMethod;
      processedById?: string;
    },
  ) {
    return this.invoiceService.listAllPayments(query);
  }

  @Get('by-service-categories')
  @ApiOperation({
    summary: 'List invoices by service category (matching line items only)',
    description:
      'Returns invoices that have at least one line item linked to a Service whose ServiceCategory name matches any of the given strings (case-insensitive). Each row includes a nested `invoice` object (id, invoiceID, status, patientId, patient, invoiceItems with service + category) plus display fields (patientName, phone, age, date). Optional filters: `status` (e.g. PAID; FULLY_PAID accepted as alias), `search`, `transactionId`, `invoiceId` / `invoiceID`, `patientName`. Categories align with seeded `ServiceCategory` names (see REF_Categories.csv).',
  })
  @ApiQuery({
    name: 'category',
    required: true,
    isArray: true,
    type: String,
    example: ['Laboratory', 'Pharmacy'],
  })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  @ApiQuery({ name: 'invoiceID', required: false, type: String })
  @ApiQuery({ name: 'patientName', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description:
      'Paginated rows with nested `invoice` and top-level patient display fields',
  })
  listByServiceCategories(@Query() query: ListInvoicesByCategoryQueryDto) {
    return this.invoiceService.listInvoicesByServiceCategories(query);
  }

  @Get('unregistered-patients')
  @ApiOperation({
    summary: 'List invoices for unregistered patients (no hospital patientId)',
    description:
      'Returns invoices whose patient has `patientId` null or empty — i.e. not yet assigned a hospital registration id. Each row: patientName, human `invoiceId`, phone, age, invoice date, and all line items as `services` (service name, drug name, or custom description).',
  })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description:
      'Paginated rows: patientName, invoiceId, phone, age, date, services[]',
  })
  listUnregisteredPatientInvoices(@Query() query: DateRangeSkipTakeDto) {
    return this.invoiceService.listInvoicesForUnregisteredPatients(query);
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

  @Post(':id/split')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Split an invoice by moving line items to a new invoice',
    description:
      'Creates a new PENDING invoice for the same patient with the same encounter and consulting room as the source. The given line items are reassigned to the new invoice; lab requests linked to those lines follow. Vitals stay on the original invoice only (unique link). The original invoice is recalculated after the move. Not allowed for paid invoices or for lines that are settled, have `amountPaid`, or have payment allocations. At least one line must remain on the original invoice.',
  })
  @ApiParam({ name: 'id', description: 'Source invoice UUID' })
  @ApiCreatedResponse({
    description:
      'Original and new invoice detail (same shape as GET /invoices/:id)',
  })
  @ApiBadRequestResponse({
    description: 'Validation or business rule violation',
  })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  splitInvoice(
    @Param('id') id: string,
    @Body() dto: SplitInvoiceDto,
    @Req() req: any,
  ) {
    return this.invoiceService.splitInvoice(id, dto, req);
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
      'Adds a service to the invoice. `unitPrice` captures the cost snapshot at the moment of invoicing, so future service price changes do not affect existing invoices.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiCreatedResponse({ description: 'Line item added' })
  @ApiNotFoundResponse({ description: 'Invoice or Service not found' })
  addItem(
    @Param('id') id: string,
    @Body() dto: AddInvoiceItemDto,
    @Req() req: any,
  ) {
    return this.invoiceService.addItem(id, dto, req.user?.sub);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({
    summary: 'Update an invoice line item',
    description:
      'Update the quantity or price snapshot for a specific line item on an invoice.',
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

  @Post(':id/allocate-item-payments')
  @ApiOperation({
    summary: 'Allocate payment to invoice line items',
    description:
      'Creates an InvoicePayment and InvoiceItemPayment rows (canonical cash-in). Supports partial or full payment per line and one payment split across multiple lines.',
  })
  @ApiCreatedResponse({
    description: 'Payment recorded and allocations created',
  })
  @ApiBadRequestResponse({
    description:
      'Validation error, overpayment, or sum of allocations ≠ amount',
  })
  allocateItemPayments(
    @Param('id') id: string,
    @Body() dto: AllocateInvoiceItemPaymentDto,
  ) {
    return this.invoiceService.allocatePaymentToInvoiceItems(id, dto);
  }

  @Post(':id/payments')
  @ApiOperation({
    summary: 'Record invoice payment',
    description:
      'Records a payment (wallet, cash, transfer, etc.) and updates invoice amountPaid and status atomically. The authenticated staff id is stored as createdBy/receivedBy on the payment when available.',
  })
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordInvoicePaymentDto,
    @Req() req: any,
  ) {
    return this.invoiceService.recordPayment(id, dto, req?.user?.sub);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'List invoice payments' })
  listPayments(@Param('id') id: string) {
    return this.invoiceService.listPayments(id);
  }

  @Get(':id/insurance-claims')
  @ApiOperation({ summary: 'List insurance claims on an invoice' })
  listInsuranceClaims(@Param('id') id: string) {
    return this.invoiceService.listInsuranceClaims(id);
  }

  @Post(':id/insurance-claims')
  @ApiOperation({ summary: 'Create insurance claim on an invoice' })
  createInsuranceClaim(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceInsuranceClaimDto,
    @Req() req: any,
  ) {
    return this.invoiceService.createInsuranceClaim(id, dto, req?.user?.sub);
  }

  @Patch(':id/insurance-claims/:claimId')
  @ApiOperation({ summary: 'Update insurance claim on an invoice' })
  updateInsuranceClaim(
    @Param('id') id: string,
    @Param('claimId') claimId: string,
    @Body() dto: UpdateInvoiceInsuranceClaimDto,
    @Req() req: any,
  ) {
    return this.invoiceService.updateInsuranceClaim(
      id,
      claimId,
      dto,
      req?.user?.sub,
    );
  }

  @Post(':id/items/:itemId/pause')
  @ApiOperation({
    summary: 'Pause recurring invoice item',
    description: 'Closes the current open usage segment for a recurring item.',
  })
  pauseRecurringItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.invoiceService.pauseRecurringItem(id, itemId);
  }

  @Post(':id/items/:itemId/resume')
  @ApiOperation({
    summary: 'Resume recurring invoice item',
    description: 'Creates a new usage segment for a recurring item.',
  })
  resumeRecurringItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.invoiceService.resumeRecurringItem(id, itemId);
  }

  @Post('wallets/:patientId/deposits')
  @ApiOperation({ summary: 'Deposit funds into patient wallet' })
  depositToWallet(
    @Param('patientId') patientId: string,
    @Body() dto: WalletDepositDto,
    @Req() req: any,
  ) {
    const staffId = dto.staffId ?? req?.user?.sub;
    return this.invoiceService.depositToWallet(patientId, dto, staffId);
  }

  @Get('wallets/:patientId')
  @ApiOperation({ summary: 'Get patient wallet balance' })
  getWallet(@Param('patientId') patientId: string) {
    return this.invoiceService.getWallet(patientId);
  }

  @Get('wallets/:patientId/transactions')
  @ApiOperation({ summary: 'Get patient wallet transactions' })
  getWalletTransactions(@Param('patientId') patientId: string) {
    return this.invoiceService.getWalletTransactions(patientId);
  }
}
