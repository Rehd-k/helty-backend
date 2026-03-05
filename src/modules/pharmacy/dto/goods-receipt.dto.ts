import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GoodsReceiptItemDto {
  @ApiProperty()
  @IsUUID()
  drugId: string;

  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsString()
  batchNumber: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  manufacturingDate: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiProperty({ example: '15.00' })
  @IsNumberString()
  costPrice: string;

  @ApiProperty({ example: '20.00' })
  @IsNumberString()
  sellingPrice: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderId: string;

  @ApiProperty({ description: 'Pharmacy location where goods are received (toLocation)' })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional({ description: 'From location (e.g. receiving dock); defaults to toLocationId if not set' })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiProperty({ type: [GoodsReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptItemDto)
  items: GoodsReceiptItemDto[];
}
