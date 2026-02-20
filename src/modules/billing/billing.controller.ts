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
import { BillingService } from './billing.service';
import { StaffService } from '../staff/staff.service';
import {
    AddBillItemDto,
    ApplyDiscountDto,
    ApplyInsuranceDto,
    CancelBillDto,
    CreateBillDto,
    CreateRefundDto,
    EditBillItemDto,
    RecordPaymentDto,
} from './dto/create-bill.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
    constructor(
        private readonly billingService: BillingService,
        private readonly staffService: StaffService,
    ) { }

    // ─── Bills ──────────────────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new bill for a patient' })
    createBill(@Body() dto: CreateBillDto) {
        return this.billingService.createBill(dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all bills (paginated)' })
    @ApiQuery({ name: 'skip', required: false, type: Number })
    @ApiQuery({ name: 'take', required: false, type: Number })
    findAll(
        @Query('skip') skip = '0',
        @Query('take') take = '20',
    ) {
        return this.billingService.findAll(+skip, +take);
    }

    @Get('patient/:patientId')
    @ApiOperation({ summary: 'Get all bills for a specific patient' })
    @ApiParam({ name: 'patientId', description: 'Patient UUID' })
    findByPatient(@Param('patientId') patientId: string) {
        return this.billingService.findByPatient(patientId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get full bill details including items, payments, discounts, insurance, refunds' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    findOne(@Param('id') id: string) {
        return this.billingService.findOne(id);
    }

    // ─── Items ──────────────────────────────────────────────────────────────────

    @Post(':id/items')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add a charge item to a bill (from any department)' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    addItem(@Param('id') id: string, @Body() dto: AddBillItemDto) {
        return this.billingService.addItem(id, dto);
    }

    @Patch(':id/items/:itemId')
    @ApiOperation({ summary: 'Edit the price of a bill item (audit-tracked)' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    @ApiParam({ name: 'itemId', description: 'BillItem UUID' })
    editItemPrice(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @Body() dto: EditBillItemDto,
    ) {
        return this.billingService.editItemPrice(id, itemId, dto);
    }

    // ─── Payments ───────────────────────────────────────────────────────────────

    @Post(':id/payments')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Record a payment on a bill (partial or full)' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
        return this.billingService.recordPayment(id, dto);
    }

    // ─── Discounts ──────────────────────────────────────────────────────────────

    @Post(':id/discounts')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Apply a discount or waiver to a bill' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    applyDiscount(@Param('id') id: string, @Body() dto: ApplyDiscountDto) {
        return this.billingService.applyDiscount(id, dto);
    }

    // ─── Insurance ──────────────────────────────────────────────────────────────

    @Post(':id/insurance')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Apply an insurance claim to a bill' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    applyInsurance(@Param('id') id: string, @Body() dto: ApplyInsuranceDto) {
        return this.billingService.applyInsurance(id, dto);
    }

    // ─── Refunds ────────────────────────────────────────────────────────────────

    @Post(':id/refunds')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Issue a refund on a bill' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    issueRefund(@Param('id') id: string, @Body() dto: CreateRefundDto) {
        return this.billingService.issueRefund(id, dto);
    }

    // ─── Cancel ─────────────────────────────────────────────────────────────────

    @Patch(':id/cancel')
    @ApiOperation({ summary: 'Cancel a bill (only if no payments have been made)' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    cancelBill(@Param('id') id: string, @Body() dto: CancelBillDto) {
        return this.billingService.cancelBill(id, dto);
    }

    // ─── Audit Log ──────────────────────────────────────────────────────────────

    @Get(':id/audit')
    @ApiOperation({ summary: 'Get the full audit trail for a bill' })
    @ApiParam({ name: 'id', description: 'Bill UUID' })
    getAuditLog(@Param('id') id: string) {
        return this.billingService.getAuditLog(id);
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
