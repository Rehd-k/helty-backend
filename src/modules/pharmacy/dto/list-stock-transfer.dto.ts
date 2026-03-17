import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { StockTransferStatus } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class ListStockTransferDto extends PaginationDto {
  @ApiProperty({
    description: 'Start date (ISO 8601). Will be normalized to start-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601). Will be normalized to end-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({ enum: StockTransferStatus })
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @ApiPropertyOptional({ description: 'Filter by from location' })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({ description: 'Filter by to location' })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'status', 'completedAt'] })
  @IsOptional()
  @IsIn(['createdAt', 'status', 'completedAt'])
  sortBy?: 'createdAt' | 'status' | 'completedAt' = undefined;
}
