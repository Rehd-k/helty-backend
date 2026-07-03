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

export class PharmacyReportDateQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
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
  locationId?: string;

  @ApiPropertyOptional({ enum: ['Cash', 'Insurance', 'Corporate', 'HMO'] })
  @IsOptional()
  @IsIn(['Cash', 'Insurance', 'Corporate', 'HMO'])
  payerType?: 'Cash' | 'Insurance' | 'Corporate' | 'HMO';
}

export class PharmacyHeadSummaryQueryDto extends PharmacyReportDateQueryDto {}

export class PharmacySalesProfitChartQueryDto extends PharmacyReportDateQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  bucketBy?: 'day' | 'week' | 'month';
}

export class PharmacySalesBreakdownQueryDto extends PharmacyReportDateQueryDto {
  @ApiPropertyOptional({
    enum: ['drug', 'therapeuticClass', 'payer', 'dispensary'],
    default: 'drug',
  })
  @IsOptional()
  @IsIn(['drug', 'therapeuticClass', 'payer', 'dispensary'])
  groupBy?: 'drug' | 'therapeuticClass' | 'payer' | 'dispensary' = 'drug';
}

export class PharmacySalesBreakdownDetailsQueryDto extends PharmacySalesBreakdownQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}

export class PharmacyInventoryValuationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({
    description: 'Only batches expiring within N days; 0 = expired only',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiryWithinDays?: number;
}

export class PharmacyInventoryValuationBatchesQueryDto extends PharmacyInventoryValuationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}
