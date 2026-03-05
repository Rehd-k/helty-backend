import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';

export class SearchBatchDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturingDateFrom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturingDateTo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expiryDateFrom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expiryDateTo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fromLocationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  toLocationId?: string;

  @ApiPropertyOptional({ enum: PharmacyLocationType })
  @IsEnum(PharmacyLocationType)
  @IsOptional()
  locationType?: PharmacyLocationType;

  @ApiPropertyOptional({ description: 'Only batches with quantityRemaining > 0' })
  @IsOptional()
  @IsString()
  inStock?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsString()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsString()
  skip?: number;

  @ApiPropertyOptional({ enum: ['batchNumber', 'manufacturingDate', 'expiryDate', 'costPrice', 'sellingPrice', 'quantityRemaining', 'createdAt'] })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

