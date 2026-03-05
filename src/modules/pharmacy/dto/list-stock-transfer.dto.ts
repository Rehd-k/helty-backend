import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { StockTransferStatus } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class ListStockTransferDto extends PaginationDto {
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
