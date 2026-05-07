import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CoverageRemittancePayerType,
  DiscountReason,
  InvoiceCoverageStatus,
} from '@prisma/client';

export class ReceivablesQueryDto {
  @ApiPropertyOptional({ description: 'From date (ISO)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'To date (ISO)' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ example: 20 })
  @Type(() => Number)
  @IsOptional()
  take?: number = 20;

  @ApiPropertyOptional({ description: 'Broad search (invoiceID, patient name)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: InvoiceCoverageStatus })
  @IsEnum(InvoiceCoverageStatus)
  @IsOptional()
  status?: InvoiceCoverageStatus;
}

export class HmoReceivablesQueryDto extends ReceivablesQueryDto {
  @ApiPropertyOptional({ description: 'HMO UUID' })
  @IsUUID()
  @IsOptional()
  hmoId?: string;
}

export class DiscountReceivablesQueryDto extends ReceivablesQueryDto {
  @ApiPropertyOptional({ enum: DiscountReason })
  @IsEnum(DiscountReason)
  @IsOptional()
  reason?: DiscountReason;

  @ApiPropertyOptional({ description: 'Owner staff UUID (payerStaffId)' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class RemittanceLineDto {
  @ApiProperty({ description: 'InvoiceCoverage UUID' })
  @IsUUID()
  coverageId!: string;

  @ApiProperty({ example: 2500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateRemittanceDto {
  @ApiProperty({ enum: CoverageRemittancePayerType })
  @IsEnum(CoverageRemittancePayerType)
  payerType!: CoverageRemittancePayerType;

  @ApiPropertyOptional({ description: 'HMO UUID when payerType=HMO' })
  @IsUUID()
  @IsOptional()
  hmoId?: string;

  @ApiPropertyOptional({ description: 'Staff UUID when payerType=STAFF' })
  @IsUUID()
  @IsOptional()
  payerStaffId?: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'paidAt ISO timestamp (defaults to now)' })
  @IsOptional()
  @IsString()
  paidAt?: string;

  @ApiProperty({ type: [RemittanceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RemittanceLineDto)
  lines!: RemittanceLineDto[];
}

