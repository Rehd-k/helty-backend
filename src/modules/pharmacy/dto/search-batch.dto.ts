import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class SearchBatchDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601). When set, filters by batch createdAt (receive date), normalized to start-of-day. Omitted means no start bound unless toDate is set.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601). When set, filters by batch createdAt (receive date), normalized to end-of-day. Omitted means no end bound unless fromDate is set.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

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
    description:
      'When true, returns only batches with quantityRemaining > 0. When false or omitted, returns all batches (including empty).',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  doNotAllowempty?: 'true' | 'false';

  @ApiPropertyOptional({
    enum: [
      'batchNumber',
      'manufacturingDate',
      'expiryDate',
      'costPrice',
      'sellingPrice',
      'quantityReceived',
      'quantityRemaining',
      'createdAt',
    ],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
