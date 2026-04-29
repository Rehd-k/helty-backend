import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';

export const DRUG_SEARCH_SORT_FIELDS = [
  'genericName',
  'brandName',
  'createdAt',
  'quantity',
  'sellingPrice',
  'expiryDate',
] as const;

export type DrugSearchSortField = (typeof DRUG_SEARCH_SORT_FIELDS)[number];

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
  @IsDateString()
  @IsOptional()
  manufacturingDateFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  manufacturingDateTo?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiryDateFrom?: string;

  @ApiPropertyOptional()
  @IsDateString()
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
  @IsDateString()
  @IsOptional()
  cursorCreatedAt?: string;

  @ApiPropertyOptional({ enum: DRUG_SEARCH_SORT_FIELDS, default: 'createdAt' })
  @IsIn(DRUG_SEARCH_SORT_FIELDS)
  @IsOptional()
  sortBy?: DrugSearchSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
