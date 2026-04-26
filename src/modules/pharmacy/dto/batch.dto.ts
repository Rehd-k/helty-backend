import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateBatchDto {
  @ApiProperty()
  @IsUUID()
  drugId: string;

  @ApiProperty({ description: 'Source location of this batch' })
  @IsUUID()
  @IsOptional()
  fromLocationId: string;

  @ApiProperty({
    description: 'Current destination/holding location of this batch',
  })
  @IsUUID()
  @IsOptional()
  toLocationId: string;

  @ApiProperty({ example: 'BATCH-2026-001' })
  @IsString()
  batchNumber: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  manufacturingDate: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Goods receipt ID if batch was created from GRN',
  })
  @IsOptional()
  @IsUUID()
  grnId?: string;

  @ApiProperty({ example: '15.00' })
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsNumberString()
  costPrice: string;

  @ApiPropertyOptional({
    example: '20.00',
    description: 'Defaults to costPrice if omitted',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value == null ? value : typeof value === 'number' ? String(value) : value,
  )
  @IsNumberString()
  sellingPrice?: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining?: number;
}

export class UpdateBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  drugId?: string;

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
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  grnId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  costPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  sellingPrice?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining?: number;
}

export class SyncWardPricingFromLatestBatchDto {
  @ApiProperty({
    description:
      'Drug id; ward prices are updated from the most recently created batch cost',
  })
  @IsUUID()
  drugId: string;
}

export class CorrectBatchQuantityDto {
  @ApiProperty({ example: 100, description: 'Corrected total quantity received' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantityReceived: number;

  @ApiProperty({ example: 100, description: 'Corrected quantity on hand' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining: number;
}
