import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMinSize,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {

    TransactionPaymentMethod,
    DiscountType,
    TransactionStatus,
} from '@prisma/client';

// ─── Create Transaction ─────────────────────────────────────────────────────────────

export class CreateTransactionDto {
    @ApiProperty({ description: 'Patient UUID' })

    @IsNotEmpty()
    patientId: string;

    @ApiProperty({ description: 'Staff UUID of the person creating the bill' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Admission UUID — if this is an inpatient bill' })

    @IsOptional()
    admissionId?: string;

    @ApiPropertyOptional({ description: 'NoIdPatient UUID — if patient has no ID' })

    @IsOptional()
    noIdPatientId?: string;

    @ApiPropertyOptional({ description: 'Optional notes for the bill' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Update Transaction ─────────────────────────────────────────────────────────────

export class UpdateTransactionDto {
    @ApiProperty({ description: 'Staff UUID of the person making this change' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Updated notes for the transaction' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiPropertyOptional({
        enum: TransactionStatus,
        description:
            'Change status — only specific transitions are allowed (e.g. reopen CANCELLED → DRAFT)',
    })
    @IsEnum(TransactionStatus)
    @IsOptional()
    status?: TransactionStatus;
}

// ─── Query / Filter Transactions ────────────────────────────────────────────────────

export class QueryTransactionDto {
    @ApiPropertyOptional({
        description: 'Free-text search across transactionID, patient name and patient phone',
        example: 'John',
    })
    @IsString()
    @IsOptional()
    search?: string;

    @ApiPropertyOptional({
        description: 'Exact or partial match on the human-readable Transaction ID (e.g. BILL-2025-00012)',
        example: 'BILL-2025',
    })
    @IsString()
    @IsOptional()
    transactionID?: string;

    @ApiPropertyOptional({ description: 'Patient UUID — filter all transactions for this patient' })

    @IsOptional()
    patientId?: string;

    @ApiPropertyOptional({
        description: 'Search by patient name (searches both firstName and surname)',
        example: 'Adewale',
    })
    @IsString()
    @IsOptional()
    patientName?: string;

    @ApiPropertyOptional({
        description: 'Search by patient phone number',
        example: '0801234',
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'Staff UUID who created the transaction (createdBy)',
    })

    @IsOptional()
    createdById?: string;

    @ApiPropertyOptional({
        enum: TransactionStatus,
        description: 'Filter by transaction status',
    })
    @IsEnum(TransactionStatus)
    @IsOptional()
    status?: TransactionStatus;

    @ApiPropertyOptional({
        description: 'Filter transactions created on or after this date (ISO 8601)',
        example: '2025-01-01',
    })
    @IsDateString()
    @IsOptional()
    fromDate?: string;

    @ApiPropertyOptional({
        description: 'Filter transactions created on or before this date (ISO 8601)',
        example: '2025-12-31',
    })
    @IsDateString()
    @IsOptional()
    toDate?: string;

    @ApiPropertyOptional({ description: 'Number of records to skip (pagination)', example: 0 })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @IsOptional()
    skip?: number = 0;

    @ApiPropertyOptional({ description: 'Number of records to return (pagination)', example: 20 })
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @IsOptional()
    take?: number = 20;

    @ApiPropertyOptional({
        description: 'Field to sort by',
        enum: ['createdAt', 'updatedAt', 'totalAmount', 'amountPaid', 'status'],
        example: 'createdAt',
    })
    @IsIn(['createdAt', 'updatedAt', 'totalAmount', 'amountPaid', 'status'])
    @IsOptional()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort direction',
        enum: ['asc', 'desc'],
        example: 'desc',
    })
    @IsIn(['asc', 'desc'])
    @IsOptional()
    sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─── Add Transaction Item ────────────────────────────────────────────────────────────

export class AddTransactionItemDto {
    @ApiProperty({ description: 'Description of the charge' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: 'Department source of the charge' })
    @IsString()
    source: string;

    @ApiProperty({ description: 'Quantity of the item', example: 1 })
    @IsNumber()
    @IsPositive()
    quantity: number;

    @ApiProperty({ description: 'Unit price of the item', example: 5000 })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ description: 'Staff UUID of the person adding this item' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Optional reference ID (e.g. lab report ID, prescription ID)' })
    @IsString()
    @IsOptional()
    referenceId?: string;
}

// ─── Edit Transaction Item ─────────────────────────────────────────────────────────────

export class EditTransactionItemDto {
    @ApiProperty({ description: 'New unit price for the item', example: 4500 })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiPropertyOptional({ description: 'New quantity for the item', example: 2 })
    @IsNumber()
    @IsPositive()
    @IsOptional()
    quantity?: number;

    @ApiPropertyOptional({ description: 'Updated description for the item' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Staff UUID of the person editing the item' })

    @IsNotEmpty()
    staffId: string;
}

// ─── Record Payment ───────────────────────────────────────────────────────────

export class RecordPaymentDto {
    @ApiProperty({ description: 'Amount being paid', example: 10000 })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ enum: TransactionPaymentMethod, description: 'Payment method' })
    @IsEnum(TransactionPaymentMethod)
    method: TransactionPaymentMethod;

    @ApiProperty({ description: 'Staff UUID of the cashier receiving this payment' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Reference number (POS receipt, bank transfer ref, etc.)' })
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiPropertyOptional({ description: 'Additional notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Apply Discount ───────────────────────────────────────────────────────────

export class ApplyDiscountDto {
    @ApiProperty({ enum: DiscountType, description: 'PERCENTAGE or FIXED amount' })
    @IsEnum(DiscountType)
    type: DiscountType;

    @ApiProperty({
        description: 'Value: percentage (e.g. 10 for 10%) or fixed naira amount (e.g. 5000)',
        example: 10,
    })
    @IsNumber()
    @Min(0)
    value: number;

    @ApiProperty({ description: 'Reason for the discount or waiver' })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ description: 'Staff UUID of the person granting the discount' })

    @IsNotEmpty()
    staffId: string;
}

// ─── Insurance Claim ──────────────────────────────────────────────────────────

export class ApplyInsuranceDto {
    @ApiProperty({ description: 'Insurance provider name', example: 'NHIS' })
    @IsString()
    @IsNotEmpty()
    provider: string;

    @ApiPropertyOptional({ description: 'Policy or HMO number' })
    @IsString()
    @IsOptional()
    policyNumber?: string;

    @ApiProperty({ description: 'Amount covered by insurance', example: 20000 })
    @IsNumber()
    @Min(0)
    coveredAmount: number;

    @ApiProperty({ description: 'Staff UUID of the person applying the insurance claim' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Additional notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Update Insurance Claim ───────────────────────────────────────────────────

export class UpdateInsuranceClaimDto {
    @ApiProperty({ description: 'Staff UUID of the person making this change' })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Updated coverage amount' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    coveredAmount?: number;

    @ApiPropertyOptional({
        description: 'Claim status',
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
    })
    @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
    @IsOptional()
    status?: string;

    @ApiPropertyOptional({ description: 'Updated notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Create Refund ────────────────────────────────────────────────────────────

export class CreateRefundDto {
    @ApiProperty({ description: 'Amount to refund', example: 5000 })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ description: 'Reason for the refund' })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ description: 'Staff UUID of the person processing the refund' })

    @IsNotEmpty()
    staffId: string;
}

// ─── Cancel Transaction ──────────────────────────────────────────────────────────────

export class CancelTransactionDto {
    @ApiProperty({ description: 'Staff UUID of the person cancelling the bill' })

    @IsNotEmpty()
    staffId: string;

    @ApiProperty({ description: 'Reason for cancellation' })
    @IsString()
    @IsNotEmpty()
    reason: string;
}

// ─── Quick Transaction — inner DTOs ──────────────────────────────────────────

export class QuickTransactionItemDto {
    @ApiProperty({ description: 'Description of the charge item', example: 'Full Blood Count' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({
        description: 'Department source of this charge',
        example: 'LAB',
    })
    @IsString()
    source: string;

    @ApiProperty({ description: 'Quantity', example: 1 })
    @IsNumber()
    @IsPositive()
    quantity: number;

    @ApiProperty({ description: 'Unit price in naira', example: 5000 })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiPropertyOptional({ description: 'Reference ID (e.g. lab report UUID, prescription UUID)' })
    @IsString()
    @IsOptional()
    referenceId?: string;
}

export class QuickTransactionDiscountDto {
    @ApiProperty({ enum: DiscountType, description: 'PERCENTAGE or FIXED' })
    @IsEnum(DiscountType)
    type: DiscountType;

    @ApiProperty({ description: 'Percentage (e.g. 10 for 10%) or fixed naira amount', example: 10 })
    @IsNumber()
    @Min(0)
    value: number;

    @ApiProperty({ description: 'Reason for discount / waiver', example: 'Staff benefit' })
    @IsString()
    @IsNotEmpty()
    reason: string;
}

export class QuickTransactionInsuranceDto {
    @ApiProperty({ description: 'Insurance provider name', example: 'NHIS' })
    @IsString()
    @IsNotEmpty()
    provider: string;

    @ApiPropertyOptional({ description: 'Policy / HMO number' })
    @IsString()
    @IsOptional()
    policyNumber?: string;

    @ApiProperty({ description: 'Amount covered by insurance', example: 10000 })
    @IsNumber()
    @Min(0)
    coveredAmount: number;

    @ApiPropertyOptional({ description: 'Additional notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

export class QuickTransactionPaymentDto {
    @ApiProperty({ description: 'Amount paid', example: 15000 })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ enum: TransactionPaymentMethod, description: 'Payment method' })
    @IsEnum(TransactionPaymentMethod)
    method: TransactionPaymentMethod;

    @ApiPropertyOptional({ description: 'Reference (POS receipt, bank transfer ref, etc.)' })
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiPropertyOptional({ description: 'Payment notes' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Quick Transaction — main DTO ─────────────────────────────────────────────

export class CreateQuickTransactionDto {
    @ApiProperty({ description: 'Patient UUID — the patient being billed' })

    @IsNotEmpty()
    patientId: string;

    @ApiProperty({
        description: 'Staff UUID of the person creating and receiving this transaction (cashier / frontdesk)',
    })

    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Admission UUID — if this is an inpatient bill' })

    @IsOptional()
    admissionId?: string;

    @ApiPropertyOptional({ description: 'NoIdPatient UUID — for patients without a formal ID' })

    @IsOptional()
    noIdPatientId?: string;

    @ApiPropertyOptional({ description: 'Optional notes for this transaction' })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty({
        type: [QuickTransactionItemDto],
        description: 'One or more charge items to add to the transaction. At least one is required.',
    })
    @ValidateNested({ each: true })
    @Type(() => QuickTransactionItemDto)
    @ArrayMinSize(1, { message: 'At least one charge item is required.' })
    items: QuickTransactionItemDto[];

    @ApiPropertyOptional({
        type: QuickTransactionDiscountDto,
        description: 'Optional discount to apply after items are totalled.',
    })
    @ValidateNested()
    @Type(() => QuickTransactionDiscountDto)
    @IsOptional()
    discount?: QuickTransactionDiscountDto;

    @ApiPropertyOptional({
        type: QuickTransactionInsuranceDto,
        description: 'Optional insurance/HMO coverage to apply.',
    })
    @ValidateNested()
    @Type(() => QuickTransactionInsuranceDto)
    @IsOptional()
    insurance?: QuickTransactionInsuranceDto;

    @ApiPropertyOptional({
        type: QuickTransactionPaymentDto,
        description:
            'Optional immediate payment. If omitted the transaction is left as ACTIVE ' +
            'and can be paid later. If provided, it must not exceed the outstanding balance ' +
            'after discounts and insurance are applied.',
    })
    @ValidateNested()
    @Type(() => QuickTransactionPaymentDto)
    @IsOptional()
    payment?: QuickTransactionPaymentDto;

    @ApiPropertyOptional({
        description:
            'Set to true to automatically pay the full outstanding balance in one shot. ' +
            'When true, `payment.amount` is ignored and the system will set it to the exact ' +
            'outstanding amount. Requires `payment.method` to still be provided.',
        example: false,
    })
    @IsOptional()
    payFull?: boolean;
}
