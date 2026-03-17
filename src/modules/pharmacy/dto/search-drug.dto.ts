import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';

export class SearchDrugDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  genericName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierId?: string;

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
  @IsNumberString()
  @IsOptional()
  minCostPrice?: string;

  @ApiPropertyOptional()
  @IsNumberString()
  @IsOptional()
  maxCostPrice?: string;

  @ApiPropertyOptional()
  @IsNumberString()
  @IsOptional()
  minSellingPrice?: string;

  @ApiPropertyOptional()
  @IsNumberString()
  @IsOptional()
  maxSellingPrice?: string;

  @ApiPropertyOptional({ enum: PharmacyLocationType })
  @IsEnum(PharmacyLocationType)
  @IsOptional()
  locationType?: PharmacyLocationType;

  @ApiPropertyOptional()
  @IsBooleanString()
  @IsOptional()
  inStock?: string;

  @ApiPropertyOptional()
  @IsBooleanString()
  @IsOptional()
  isControlled?: string;

  @ApiPropertyOptional({
    description: 'Full-text search across generic and brand names',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsNumberString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cursorId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cursorCreatedAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
