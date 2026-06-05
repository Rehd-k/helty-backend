import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchasesGoodsReceiptItemDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

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

  @ApiProperty()
  @IsNumberString()
  costPrice: string;
}

export class CreatePurchasesGoodsReceiptDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiProperty({ type: [CreatePurchasesGoodsReceiptItemDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchasesGoodsReceiptItemDto)
  @ArrayMinSize(1)
  items: CreatePurchasesGoodsReceiptItemDto[];
}
