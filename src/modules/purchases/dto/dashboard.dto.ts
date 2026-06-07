import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PurchasesDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class PurchasesUsageHistoryQueryDto extends PurchasesDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchasesLocationId?: string;

  @ApiPropertyOptional({
    description: 'Patient search text (name or patientId)',
  })
  @IsOptional()
  @IsString()
  patientQuery?: string;

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
}
