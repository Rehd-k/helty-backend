import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchaseItemBatchDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional({
    description:
      'Patient-facing selling price. Defaults to item catalog price when omitted. 0 means free.',
    example: 1500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  grnId?: string;
}

export class UpdatePurchaseItemBatchDto extends PartialType(
  CreatePurchaseItemBatchDto,
) { }

export class CorrectBatchQuantityDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityReceived: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining: number;
}

export class SearchPurchaseItemBatchDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

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
  toLocationId?: string;
}
