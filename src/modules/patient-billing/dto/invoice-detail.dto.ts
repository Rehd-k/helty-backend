import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionStatus, InvoicePaymentMethod, InvoiceStatus } from '@prisma/client';
import { PatientBillType, PatientChargeCategory } from '../patient-billing.constants';

export class PatientAdmissionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  wardName!: string;

  @ApiProperty()
  admittedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  dischargedAt?: Date | null;

  @ApiProperty({ enum: AdmissionStatus })
  status!: AdmissionStatus;
}

export class BreakdownLineItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  lineTotal!: string;

  @ApiProperty()
  amountPaid!: string;

  @ApiProperty()
  balance!: string;

  @ApiProperty()
  isRecurringDaily!: boolean;

  @ApiPropertyOptional({ nullable: true })
  billableDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  usageSummary?: string | null;
}

export class BreakdownCategoryDto {
  @ApiProperty({ enum: PatientChargeCategory })
  category!: PatientChargeCategory;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  amountPaid!: string;

  @ApiProperty()
  balance!: string;

  @ApiProperty({ type: [BreakdownLineItemDto] })
  items!: BreakdownLineItemDto[];
}

export class InvoicePaymentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  amount!: string;

  @ApiPropertyOptional({ enum: InvoicePaymentMethod, nullable: true })
  method?: InvoicePaymentMethod | null;

  @ApiProperty()
  methodLabel!: string;

  @ApiProperty()
  paidAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  reference?: string | null;
}

export class InvoiceDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty({ enum: PatientBillType })
  billType!: PatientBillType;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  amountPaid!: string;

  @ApiProperty()
  balance!: string;

  @ApiPropertyOptional({ type: PatientAdmissionSummaryDto, nullable: true })
  admission?: PatientAdmissionSummaryDto | null;

  @ApiProperty({ type: [BreakdownCategoryDto] })
  breakdown!: BreakdownCategoryDto[];

  @ApiProperty({ type: [InvoicePaymentSummaryDto] })
  payments!: InvoicePaymentSummaryDto[];
}
