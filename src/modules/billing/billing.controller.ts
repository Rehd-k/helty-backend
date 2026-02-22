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
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './billing.service';
import { StaffService } from '../staff/staff.service';
import { CreateTransactionDto, AddTransactionItemDto, EditTransactionItemDto, RecordPaymentDto, ApplyDiscountDto, ApplyInsuranceDto, CreateRefundDto, CancelTransactionDto } from './dto/create-bill.dto';


@ApiTags('Transaction')
@Controller('transaction')
export class TransactionController {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly staffService: StaffService,
    ) { }

    // ─── Transactions ──────────────────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new transaction for a patient' })
    createTransaction(@Body() dto: CreateTransactionDto) {
        return this.transactionService.createTransaction(dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all transactions (paginated)' })
    @ApiQuery({ name: 'skip', required: false, type: Number })
    @ApiQuery({ name: 'take', required: false, type: Number })
    findAll(
        @Query('skip') skip = '0',
        @Query('take') take = '20',
    ) {
        return this.transactionService.findAll(+skip, +take);
    }

    @Get('patient/:patientId')
    @ApiOperation({ summary: 'Get all transactions for a specific patient' })
    @ApiParam({ name: 'patientId', description: 'Patient UUID' })
    findByPatient(@Param('patientId') patientId: string) {
        return this.transactionService.findByPatient(patientId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get full transaction details including items, payments, discounts, insurance, refunds' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    findOne(@Param('id') id: string) {
        return this.transactionService.findOne(id);
    }

    // ─── Items ──────────────────────────────────────────────────────────────────

    @Post(':id/items')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add a charge item to a transaction (from any department)' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    addItem(@Param('id') id: string, @Body() dto: AddTransactionItemDto) {
        return this.transactionService.addItem(id, dto);
    }

    @Patch(':id/items/:itemId')
    @ApiOperation({ summary: 'Edit the price of a transaction item (audit-tracked)' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    @ApiParam({ name: 'itemId', description: 'TransactionItem UUID' })
    editItemPrice(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @Body() dto: EditTransactionItemDto,
    ) {
        return this.transactionService.editItemPrice(id, itemId, dto);
    }

    // ─── Payments ───────────────────────────────────────────────────────────────

    @Post(':id/payments')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Record a payment on a transaction (partial or full)' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
        return this.transactionService.recordPayment(id, dto);
    }

    // ─── Discounts ──────────────────────────────────────────────────────────────

    @Post(':id/discounts')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Apply a discount or waiver to a transaction' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    applyDiscount(@Param('id') id: string, @Body() dto: ApplyDiscountDto) {
        return this.transactionService.applyDiscount(id, dto);
    }

    // ─── Insurance ──────────────────────────────────────────────────────────────

    @Post(':id/insurance')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Apply an insurance claim to a transaction' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    applyInsurance(@Param('id') id: string, @Body() dto: ApplyInsuranceDto) {
        return this.transactionService.applyInsurance(id, dto);
    }

    // ─── Refunds ────────────────────────────────────────────────────────────────

    @Post(':id/refunds')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Issue a refund on a transaction' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    issueRefund(@Param('id') id: string, @Body() dto: CreateRefundDto) {
        return this.transactionService.issueRefund(id, dto);
    }

    // ─── Cancel ─────────────────────────────────────────────────────────────────

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Cancel a transaction (only if no payments have been made)' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    cancelTransaction(@Param('id') id: string, @Body() dto: CancelTransactionDto) {
        return this.transactionService.cancelTransaction(id, dto);
    }

    // ─── Audit Log ──────────────────────────────────────────────────────────────

    @Get(':id/audit')
    @ApiOperation({ summary: 'Get the full audit trail for a transaction' })
    @ApiParam({ name: 'id', description: 'Transaction UUID' })
    getAuditLog(@Param('id') id: string) {
        return this.transactionService.getAuditLog(id);
    }

    // ─── Staff ──────────────────────────────────────────────────────────────────

    @Post('staff')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a staff member (used for audit trail)' })
    createStaff(
        @Body()
        dto: {
            staffId: string;
            firstName: string;
            lastName: string;
            role: string;
            department?: string;
            email?: string;
            phone?: string;
        },
    ) {
        // forward to central staff service
        return this.staffService.create(dto as any);
    }

    @Get('staff/all')
    @ApiOperation({ summary: 'List all staff members' })
    findAllStaff() {
        return this.staffService.findAll();
    }
}
