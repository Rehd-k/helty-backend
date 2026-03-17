import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class SearchBatchDto extends PaginationDto {
  @ApiProperty({
    description:
      'Start date (ISO 8601). Filters by batch createdAt. Normalized to start-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description:
      'End date (ISO 8601). Filters by batch createdAt. Normalized to end-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  batchNumber?: string;

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
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  fromLocationId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  toLocationId?: string;

  @ApiPropertyOptional({ enum: PharmacyLocationType })
  @IsEnum(PharmacyLocationType)
  @IsOptional()
  locationType?: PharmacyLocationType;

  @ApiPropertyOptional({
    description: 'Only batches with quantityRemaining > 0',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  inStock?: 'true' | 'false';

  @ApiPropertyOptional({
    enum: [
      'batchNumber',
      'manufacturingDate',
      'expiryDate',
      'costPrice',
      'sellingPrice',
      'quantityRemaining',
      'createdAt',
    ],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
