import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PharmacyDashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601). Will be normalized to start-of-day. Defaults to today if omitted/invalid.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601). Will be normalized to end-of-day. Defaults to today if omitted/invalid.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pharmacistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  drugId?: string;

  @ApiPropertyOptional({
    description: 'Patient search text (name or patientId) for dispense history',
  })
  @IsOptional()
  @IsString()
  patientQuery?: string;

  @ApiPropertyOptional({ enum: ['Cash', 'Insurance', 'Corporate', 'HMO'] })
  @IsOptional()
  @IsIn(['Cash', 'Insurance', 'Corporate', 'HMO'])
  payerType?: 'Cash' | 'Insurance' | 'Corporate' | 'HMO';

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class PharmacyDashboardChartQueryDto extends PharmacyDashboardQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  bucketBy?: 'day' | 'week' | 'month' = 'day';
}

export class PharmacyDrugUsageChartQueryDto extends PharmacyDashboardChartQueryDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated drug IDs to force-include in usage chart series. If omitted, top-selling drugs are used.',
  })
  @IsOptional()
  @IsString()
  drugIds?: string;
}
