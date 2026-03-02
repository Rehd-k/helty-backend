import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { TransactionService } from './billing.service';
import {
    AddTransactionItemDto,
    ApplyDiscountDto,
    ApplyInsuranceDto,
    CancelTransactionDto,
    CreateQuickTransactionDto,
    CreateRefundDto,
    CreateTransactionDto,
    EditTransactionItemDto,
    QueryTransactionDto,
    RecordPaymentDto,
    UpdateInsuranceClaimDto,
    UpdateTransactionDto,
} from './dto/create-bill.dto';

@ApiTags('Transactions')
@Controller('transaction')
export class TransactionController {
    constructor(private readonly transactionService: TransactionService) { }

    // ─── Quick (one-shot) Transaction ────────────────────────────────────────────

    @Post('quick')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a fully-calculated one-shot transaction (items + discount + insurance + payment)',
        description:
            'Use this for walk-in patients or any scenario where all charges are known upfront.\n\n' +
            '**One request does all of the following atomically:**\n' +
            '1. Opens a new transaction\n' +
            '2. Inserts all provided charge items\n' +
            '3. Computes `totalAmount = Σ(unitPrice × quantity)` for each item\n' +
            '4. Applies optional **discount** (PERCENTAGE or FIXED naira)\n' +
            '5. Applies optional **insurance/HMO** coverage\n' +
            '6. Records optional **payment** (partial or full)\n' +
            '7. Sets final status: DRAFT / ACTIVE / PARTIALLY_PAID / PAID\n' +
            '8. Writes one consolidated audit log entry\n' +
            '9. Returns the fully-hydrated transaction with `outstandingBalance`\n\n' +
            '**`payFull: true`** — auto-calculates and pays the exact outstanding balance. ' +
            'Still requires `payment.method` to be provided.\n\n' +
            '**No payment** — omit `payment` entirely; the transaction is saved as ACTIVE ' +
            'and the cashier can call `POST /transaction/:id/payments` to collect later.',
    })
    @ApiCreatedResponse({
        description:
            'Fully-hydrated transaction — same shape as GET /transaction/:id — ' +
            'with all items, payments, discounts, insurance claims, and `outstandingBalance`.',
    })
    @ApiNotFoundResponse({ description: 'Patient, Staff, or Admission not found.' })
    @ApiBadRequestResponse({
        description:
            'Validation failed: invalid quantity/price, discount exceeds total, ' +
            'insurance exceeds billable amount, payment exceeds outstanding balance, ' +
            'or payment method missing when payFull is true.',
    })
    createQuickTransaction(@Body() dto: any) {
        return this.transactionService.createQuickTransaction(dto);
    }

    // ─── Create Transaction ─────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new transaction',
        description:
            'Opens a new billing transaction (status: DRAFT) for a patient. ' +
            'Add items before recording payments.',
    })
    @ApiCreatedResponse({ description: 'Transaction created successfully.' })
    @ApiNotFoundResponse({ description: 'Patient, Staff, or Admission not found.' })
    @ApiBadRequestResponse({ description: 'Admission does not belong to the given patient.' })
    createTransaction(@Body() dto: CreateTransactionDto) {
        return this.transactionService.createTransaction(dto);
    }

    // ─── List / Search Transactions ─────────────────────────────────────────────

    @Get()
    @ApiOperation({
        summary: 'List transactions with filters',
        description:
            'Returns a paginated, filterable list of all transactions. ' +
            'You can filter by transactionID, patientId, patient name, phone number, ' +
            'createdBy (staff UUID), status, and date range. ' +
            'The `search` param does a cross-field search across transaction ID, patient name, phone, and staff name. ' +
            'Response includes total count and pageCount for pagination.',
    })

    @ApiQuery({ name: 'search', required: false, description: 'Free-text search (transactionID, patient name/phone, staff name)' })
    @ApiQuery({ name: 'transactionID', required: false, description: 'Partial match on Transaction ID (e.g. BILL-2025)' })
    @ApiQuery({ name: 'patientId', required: false, description: 'Filter by Patient UUID' })
    @ApiQuery({ name: 'patientName', required: false, description: 'Search by patient first or last name' })
    @ApiQuery({ name: 'phoneNumber', required: false, description: 'Search by patient phone number' })
    @ApiQuery({ name: 'createdById', required: false, description: 'Filter by the Staff UUID who created the transaction' })
    @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ACTIVE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED'], description: 'Filter by transaction status' })
    @ApiQuery({ name: 'fromDate', required: false, description: 'Start date (ISO 8601, e.g. 2025-01-01)' })
    @ApiQuery({ name: 'toDate', required: false, description: 'End date (ISO 8601, e.g. 2025-12-31) — inclusive of entire day' })
    @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Records to skip (default: 0)' })
    @ApiQuery({ name: 'take', required: false, type: Number, description: 'Records to return (default: 20)' })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'totalAmount', 'amountPaid', 'status'], description: 'Sort field (default: createdAt)' })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort direction (default: desc)' })
    @ApiOkResponse({ description: 'Returns { data, total, skip, take, pageCount }.' })
    findAll(@Query() query: QueryTransactionDto) {
        return this.transactionService.findAll(query);
    }

    // ─── Get All for a Patient ──────────────────────────────────────────────────

    @Get('patient/:patientId')
    @ApiOperation({
        summary: 'Get all transactions for a specific patient',
        description: 'Returns all transactions for a patient (by UUID) plus aggregated count.',
    })
    @ApiParam({ name: 'patientId', description: 'Patient UUID' })
    @ApiOkResponse({ description: 'Returns { patient, data, total }.' })
    @ApiNotFoundResponse({ description: 'Patient not found.' })
    findByPatient(@Param('patientId') patientId: string) {
        return this.transactionService.findByPatient(patientId);
    }

    // ─── Get One Transaction ────────────────────────────────────────────────────

    @Get(':id')
    @ApiOperation({
        summary: 'Get full transaction details',
        description:
            'Returns a single transaction with all related entities: ' +
            'patient, admission, items (with who added them), payments, discounts, ' +
            'insurance claims, refunds, and computed outstandingBalance. ' +
            '`id` can be the internal UUID or the human-readable transactionID (e.g. BILL-2025-00001).',
    })
    @ApiParam({
        name: 'id',
        description: 'Transaction UUID or human-readable transactionID (BILL-YYYY-NNNNN)',
    })
    @ApiOkResponse({ description: 'Full transaction detail with outstandingBalance.' })
    @ApiNotFoundResponse({ description: 'Transaction not found.' })
    findOne(@Param('id') id: string) {
        return this.transactionService.findOne(id);
    }

    // ─── Update Transaction ─────────────────────────────────────────────────────

    @Patch(':id')
    @ApiOperation({
        summary: 'Update a transaction',
        description:
            'Updates editable fields on a transaction. ' +
            'Currently supports updating `notes` and reopening a cancelled transaction (CANCELLED → DRAFT). ' +
            'All changes are audit-logged. ' +
            '`id` can be the UUID or the human-readable transactionID.',
    })
    @ApiParam({
        name: 'id',
        description: 'Transaction UUID or human-readable transactionID',
    })
    @ApiOkResponse({ description: 'Transaction updated successfully.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiUnprocessableEntityResponse({ description: 'Invalid status transition (e.g. PAID → DRAFT is not allowed).' })
    updateTransaction(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
        return this.transactionService.update(id, dto);
    }

    // ─── Items ──────────────────────────────────────────────────────────────────

    @Post(':id/items')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Add a charge item to a transaction',
        description:
            'Adds a billable item from any department (LAB, PHARMACY, CONSULTATION, etc.). ' +
            'The transaction total is recalculated automatically and the status is updated.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiCreatedResponse({ description: 'Item added. Transaction total updated.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Transaction is cancelled, or invalid price/quantity.' })
    addItem(@Param('id') id: string, @Body() dto: AddTransactionItemDto) {
        return this.transactionService.addItem(id, dto);
    }

    @Patch(':id/items/:itemId')
    @ApiOperation({
        summary: 'Edit a transaction item (price, quantity, or description)',
        description:
            'Edits the unit price, quantity, and/or description of an existing line item. ' +
            'The new total is computed automatically. The change is fully audit-logged.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiParam({ name: 'itemId', description: 'TransactionItem UUID' })
    @ApiOkResponse({ description: 'Item updated and transaction total recalculated.' })
    @ApiNotFoundResponse({ description: 'Transaction, Item, or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Transaction is cancelled, or invalid price/quantity.' })
    editItem(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @Body() dto: EditTransactionItemDto,
    ) {
        return this.transactionService.editItemPrice(id, itemId, dto);
    }

    // ─── Payments ───────────────────────────────────────────────────────────────

    @Post(':id/payments')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Record a payment on a transaction',
        description:
            'Records a full or partial payment. Automatically updates amountPaid and sets status ' +
            'to PARTIALLY_PAID or PAID. Rejects payments that exceed the outstanding balance.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiCreatedResponse({ description: 'Payment recorded. Returns payment + newOutstanding + newStatus.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({
        description:
            'Transaction is cancelled or already PAID, no items added yet, ' +
            'or payment exceeds outstanding balance.',
    })
    recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
        return this.transactionService.recordPayment(id, dto);
    }

    // ─── Discounts ──────────────────────────────────────────────────────────────

    @Post(':id/discounts')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Apply a discount or waiver to a transaction',
        description:
            'Applies a PERCENTAGE (e.g. 10 for 10%) or FIXED naira amount discount. ' +
            'Validates that total discounts do not exceed the transaction total. ' +
            'Requires a reason and the staff member granting the discount.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiCreatedResponse({ description: 'Discount applied.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Transaction cancelled, no items, percentage > 100%, or discounts exceed total.' })
    applyDiscount(@Param('id') id: string, @Body() dto: ApplyDiscountDto) {
        return this.transactionService.applyDiscount(id, dto);
    }

    // ─── Insurance ──────────────────────────────────────────────────────────────

    @Post(':id/insurance')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Apply an insurance claim to a transaction',
        description:
            'Records insurance coverage from a provider. ' +
            'Validates that the covered amount does not exceed the remaining balance.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiCreatedResponse({ description: 'Insurance claim recorded.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Coverage exceeds remaining balance.' })
    applyInsurance(@Param('id') id: string, @Body() dto: ApplyInsuranceDto) {
        return this.transactionService.applyInsurance(id, dto);
    }

    @Patch(':id/insurance/:claimId')
    @ApiOperation({
        summary: 'Update an insurance claim',
        description: 'Updates the status, covered amount, or notes of an existing insurance claim.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiParam({ name: 'claimId', description: 'InsuranceClaim UUID' })
    @ApiOkResponse({ description: 'Claim updated.' })
    @ApiNotFoundResponse({ description: 'Transaction, Claim, or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Updated coverage would exceed remaining balance.' })
    updateInsuranceClaim(
        @Param('id') id: string,
        @Param('claimId') claimId: string,
        @Body() dto: UpdateInsuranceClaimDto,
    ) {
        return this.transactionService.updateInsuranceClaim(id, claimId, dto);
    }

    // ─── Refunds ────────────────────────────────────────────────────────────────

    @Post(':id/refunds')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Issue a refund on a transaction',
        description:
            'Issues a partial or full refund. Validates that the refund amount does not ' +
            'exceed the total amount already paid. Updates amountPaid and sets status to ' +
            'REFUNDED, PAID, or PARTIALLY_PAID accordingly.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiCreatedResponse({ description: 'Refund issued. Returns refund + newStatus + newAmountPaid.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({ description: 'Refund amount exceeds total amount paid.' })
    issueRefund(@Param('id') id: string, @Body() dto: CreateRefundDto) {
        return this.transactionService.issueRefund(id, dto);
    }

    // ─── Cancel ─────────────────────────────────────────────────────────────────

    @Patch(':id/cancel')
    @ApiOperation({
        summary: 'Cancel a transaction',
        description:
            'Cancels a transaction. Only allowed if no payments have been made. ' +
            'If payments exist, issue a full refund first, then cancel. Requires a cancellation reason.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiOkResponse({ description: 'Transaction cancelled.' })
    @ApiNotFoundResponse({ description: 'Transaction or Staff not found.' })
    @ApiBadRequestResponse({
        description: 'Transaction is already cancelled, or payments have been made.',
    })
    cancelTransaction(@Param('id') id: string, @Body() dto: CancelTransactionDto) {
        return this.transactionService.cancelTransaction(id, dto);
    }

    // ─── Audit Log ──────────────────────────────────────────────────────────────

    @Get(':id/audit')
    @ApiOperation({
        summary: 'Get the full audit trail for a transaction',
        description:
            'Returns every audit log entry for this transaction in chronological order. ' +
            'Each entry records who performed the action, when, and what changed. ' +
            'Paginated — use skip/take for large histories.',
    })
    @ApiParam({ name: 'id', description: 'Transaction UUID or transactionID' })
    @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Records to skip (default: 0)' })
    @ApiQuery({ name: 'take', required: false, type: Number, description: 'Records to return (default: 50)' })
    @ApiOkResponse({ description: 'Returns { logs, total, skip, take }.' })
    @ApiNotFoundResponse({ description: 'Transaction not found.' })
    getAuditLog(
        @Param('id') id: string,
        @Query('skip') skip = '0',
        @Query('take') take = '50',
    ) {
        return this.transactionService.getAuditLog(id, +skip, +take);
    }
}
