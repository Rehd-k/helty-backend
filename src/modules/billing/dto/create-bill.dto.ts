import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';
import { BillItemSource, BillPaymentMethod, DiscountType } from '@prisma/client';

// ─── Create Bill ─────────────────────────────────────────────────────────────

export class CreateBillDto {
    @ApiProperty({ description: 'Patient ID (UUID)' })
    @IsUUID()
    @IsNotEmpty()
    patientId: string;

    @ApiProperty({ description: 'Staff ID of the person creating the bill' })
    @IsUUID()
    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Admission ID if this is an inpatient bill' })
    @IsUUID()
    @IsOptional()
    admissionId?: string;

    @ApiPropertyOptional({ description: 'Optional notes for the bill' })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── Add Bill Item ────────────────────────────────────────────────────────────

export class AddBillItemDto {
    @ApiProperty({ description: 'Description of the charge' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ enum: BillItemSource, description: 'Department source of the charge' })
    @IsEnum(BillItemSource)
    source: BillItemSource;

    @ApiProperty({ description: 'Quantity of the item', example: 1 })
    @IsNumber()
    @IsPositive()
    quantity: number;

    @ApiProperty({ description: 'Unit price of the item', example: 5000 })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ description: 'Staff ID of the person adding this item' })
    @IsUUID()
    @IsNotEmpty()
    staffId: string;

    @ApiPropertyOptional({ description: 'Optional reference ID (e.g. lab report ID, prescription ID)' })
    @IsString()
    @IsOptional()
    referenceId?: string;
}

// ─── Edit Bill Item Price ─────────────────────────────────────────────────────

export class EditBillItemDto {
    @ApiProperty({ description: 'New unit price for the item', example: 4500 })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ description: 'Staff ID of the person editing the price' })
    @IsUUID()
    @IsNotEmpty()
    staffId: string;
}

// ─── Record Payment ───────────────────────────────────────────────────────────

export class RecordPaymentDto {
    @ApiProperty({ description: 'Amount being paid', example: 10000 })
    @IsNumber()
    @IsPositive()
    amount: number;

    @ApiProperty({ enum: BillPaymentMethod, description: 'Payment method' })
    @IsEnum(BillPaymentMethod)
    method: BillPaymentMethod;

    @ApiProperty({ description: 'Staff ID of the cashier receiving this payment' })
    @IsUUID()
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

    @ApiProperty({ description: 'Value: percentage (e.g. 10 for 10%) or fixed amount (e.g. 5000)', example: 10 })
    @IsNumber()
    @Min(0)
    value: number;

    @ApiProperty({ description: 'Reason for the discount or waiver' })
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ description: 'Staff ID of the person granting the discount' })
    @IsUUID()
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

    @ApiPropertyOptional({ description: 'Additional notes' })
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

    @ApiProperty({ description: 'Staff ID of the person processing the refund' })
    @IsUUID()
    @IsNotEmpty()
    staffId: string;
}

// ─── Cancel Bill ──────────────────────────────────────────────────────────────

export class CancelBillDto {
    @ApiProperty({ description: 'Staff ID of the person cancelling the bill' })
    @IsUUID()
    @IsNotEmpty()
    staffId: string;

    @ApiProperty({ description: 'Reason for cancellation' })
    @IsString()
    @IsNotEmpty()
    reason: string;
}
