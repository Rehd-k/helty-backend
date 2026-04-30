import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';
import {
  InvoicePaymentMethod,
  InvoicePaymentSource,
  InvoiceStatus,
} from '@prisma/client';

// ─── Invoice DTOs ──────────────────────────────────────────────────────────────

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'UUID of the patient this invoice belongs to',
    example: 'a1b2c3d4-…',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({
    enum: InvoiceStatus,
    description: 'Initial status of the invoice',
    example: InvoiceStatus.PENDING,
  })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'UUID of a staff member to associate with this invoice',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the encounter this invoice is tied to (for medication orders, same encounter = same invoice)',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({
    description: 'Optional consulting room UUID assigned for nursing queue',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  consultingRoomId?: string;

  @ApiPropertyOptional({
    description: 'Optional vitals UUID linked to this invoice (one-to-one)',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  vitalsId?: string;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) { }

/** Body for POST /invoices/:id/split */
export class SplitInvoiceDto {
  @ApiProperty({
    type: [String],
    description:
      'UUIDs of invoice line items currently on this invoice to move onto a new invoice',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one invoice line id is required' })
  @IsUUID('4', { each: true })
  invoiceItemIds!: string[];
}

/** Query for GET /invoices/by-service-categories */
export class ListInvoicesByCategoryQueryDto extends DateRangeSkipTakeDto {
  @ApiProperty({
    type: [String],
    isArray: true,
    description:
      'Service category names (as in REF_Categories / ServiceCategory.name). Repeat `category=` or use comma-separated values.',
    example: ['Laboratory', 'Pharmacy'],
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one category is required' })
  @IsString({ each: true })
  category!: string[];

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    description:
      'Filter by invoice status. Use PAID for paid-waiting lists. FULLY_PAID is accepted as an alias for PAID.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = String(value).trim().toUpperCase().replace(/\s+/g, '_');
    if (v === 'FULLY_PAID') return InvoiceStatus.PAID;
    return value;
  })
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description:
      'Broad search: matches invoice UUID, human invoiceID (substring), patient first/surname, hospital patientId, or payment reference',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment reference (substring, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by human invoice number or invoice UUID (substring on invoiceID; exact UUID matches id)',
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Same as `invoiceId` (alternate query key used by some clients)',
  })
  @IsOptional()
  @IsString()
  invoiceID?: string;

  @ApiPropertyOptional({
    description: 'Filter by patient first or last name (substring, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  patientName?: string;
}

// ─── InvoiceItem DTOs ──────────────────────────────────────────────────────────

export class AddInvoiceItemDto {
  @ApiProperty({
    description: 'UUID of the service to add as a line item',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiProperty({
    description: 'UUID of the service to add as a line item',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({
    description: 'Quantity of the service rendered',
    example: 1,
    default: 1,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Unit price used for this line item',
    example: 3500,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Marks this item as recurring daily billing',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRecurringDaily?: boolean;

  @ApiPropertyOptional({
    description:
      'When isRecurringDaily is true: start of the first billing segment (ISO 8601). Defaults to server time "now" if omitted.',
    example: '2026-03-27T08:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  recurringSegmentStartAt?: string;
}

/** Replace one drug on an invoice line with another (atomic; same line item id). */
export class SubstituteDrugInvoiceItemDto {
  @ApiProperty({
    description: 'UUID of the replacement drug',
    example: 'uuid-here',
  })
  @IsUUID()
  drugId!: string;

  @ApiPropertyOptional({
    description:
      'Quantity for the replacement line. Defaults to the current line quantity.',
    example: 2,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    description:
      'Unit price snapshot for the replacement. Defaults to the current line unit price.',
    example: 3200,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;
}

export class UpdateInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Updated quantity', example: 2 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Updated unit price',
    example: 3200,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Updated settled status',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  settled?: boolean;
}

export class RecordInvoicePaymentDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({
    enum: InvoicePaymentSource,
    example: InvoicePaymentSource.CASH,
  })
  @IsEnum(InvoicePaymentSource)
  source!: InvoicePaymentSource;

  @ApiPropertyOptional({
    description:
      'Finer payment method (CARD, etc.). When omitted, derived from `source` where applicable.',
    enum: InvoicePaymentMethod,
  })
  @IsOptional()
  @IsEnum(InvoicePaymentMethod)
  method?: InvoicePaymentMethod;

  @ApiPropertyOptional({
    description: 'Reference for cash/transfer receipt or wallet usage context',
    example: 'cash-receipt-10023',
  })
  @IsOptional()
  @IsNotEmpty()
  reference?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Registered bank account number when payment is lodged to a bank',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;
}

export class InvoiceItemAllocationDto {
  @ApiProperty({ description: 'InvoiceItem UUID on this invoice' })
  @IsUUID()
  @IsNotEmpty()
  invoiceItemId!: string;

  @ApiProperty({
    description: 'Amount of this payment applied to the line',
    example: 1500,
  })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class AllocateInvoiceItemPaymentDto {
  @ApiProperty({ description: 'Staff UUID receiving / recording the payment' })
  @IsUUID()
  @IsNotEmpty()
  staffId!: string;

  @ApiProperty({
    description: 'Total payment amount (must equal sum of allocations)',
  })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: InvoicePaymentMethod })
  @IsEnum(InvoicePaymentMethod)
  method!: InvoicePaymentMethod;

  @ApiPropertyOptional({ description: 'Receipt / transfer reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Bank account number registered in the system (same as transaction record payment)',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({
    type: [InvoiceItemAllocationDto],
    description: 'How the payment is split across invoice lines',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemAllocationDto)
  allocations!: InvoiceItemAllocationDto[];
}

export class WalletDepositDto {
  @ApiProperty({ example: 10000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({
    description: 'Deposit reference',
    example: 'deposit',
  })
  @IsOptional()
  @IsNotEmpty()
  reference?: string;

  @ApiPropertyOptional({
    description:
      'Staff UUID recording the deposit (optional if the server sets it from the auth token)',
  })
  @IsUUID()
  @IsOptional()
  staffId?: string;
}

export class CreateInvoiceInsuranceClaimDto {
  @ApiProperty({ example: 'NHIS' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiPropertyOptional({ example: 'POL-12345' })
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @IsPositive()
  coveredAmount!: number;

  @ApiPropertyOptional({ example: 'Approved by provider desk' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Staff UUID creating the claim' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class UpdateInvoiceInsuranceClaimDto {
  @ApiPropertyOptional({ example: 'NHIS' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  provider?: string;

  @ApiPropertyOptional({ example: 'POL-12345' })
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  coveredAmount?: number;

  @ApiPropertyOptional({ example: 'APPROVED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Updated after review' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Staff UUID updating the claim' })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}
