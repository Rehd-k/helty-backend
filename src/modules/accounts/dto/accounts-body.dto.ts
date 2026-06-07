import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChartOfAccountType,
  CmdComplianceStatus,
  FinanceApprovalType,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AcknowledgeComplianceDto {
  @ApiProperty({ enum: CmdComplianceStatus })
  @IsEnum(CmdComplianceStatus)
  status!: CmdComplianceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitDailyCashDto {
  @ApiProperty({ example: '2026-06-07' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 118500 })
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBankReconciliationDto {
  @ApiProperty()
  @IsString()
  bankId!: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  statementDate!: string;

  @ApiProperty()
  @IsNumber()
  statementBalance!: number;
}

export class ReviewApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectApprovalDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ example: '2026-06-07' })
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ example: 'JE-2026-0042' })
  @IsString()
  reference!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ example: '4100', description: 'Chart of account code' })
  @IsString()
  debitAccount!: string;

  @ApiProperty({ example: '2100' })
  @IsString()
  creditAccount!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreateChartOfAccountDto {
  @ApiProperty({ example: '4100' })
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ChartOfAccountType })
  @IsEnum(ChartOfAccountType)
  type!: ChartOfAccountType;
}

export class UpdateChartOfAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class CreateFinanceApprovalDto {
  @ApiProperty({ enum: FinanceApprovalType })
  @IsEnum(FinanceApprovalType)
  type!: FinanceApprovalType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detail?: string;
}
