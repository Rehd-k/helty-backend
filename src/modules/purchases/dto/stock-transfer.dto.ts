import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchasesStockTransferStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchasesStockTransferLineDto {
  @ApiProperty()
  @IsUUID()
  batchId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreatePurchasesStockTransferDto {
  @ApiProperty()
  @IsUUID()
  fromLocationId: string;

  @ApiProperty()
  @IsUUID()
  toLocationId: string;

  @ApiProperty({ type: [CreatePurchasesStockTransferLineDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchasesStockTransferLineDto)
  @ArrayMinSize(1)
  items: CreatePurchasesStockTransferLineDto[];
}

export class ListPurchasesStockTransferDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PurchasesStockTransferStatus })
  @IsOptional()
  @IsEnum(PurchasesStockTransferStatus)
  status?: PurchasesStockTransferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;
}

export class TransferHistoryQueryDto {
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
  itemId?: string;

  @ApiPropertyOptional({ enum: PurchasesStockTransferStatus })
  @IsOptional()
  @IsEnum(PurchasesStockTransferStatus)
  status?: PurchasesStockTransferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  take?: number = 20;
}
