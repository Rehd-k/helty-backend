import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PharmacyLocationType } from '@prisma/client';

export class CreateConsumableDto {
  @ApiProperty({ example: 'Syringe 10ml' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Disposables' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBillable?: boolean;
}

export class UpdateConsumableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBillable?: boolean;
}

export class CreateConsumableBatchDto {
  @ApiProperty({ enum: PharmacyLocationType })
  @IsEnum(PharmacyLocationType)
  locationType: PharmacyLocationType;

  @ApiProperty({ description: 'Pharmacy location ID that holds this batch' })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityReceived: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRemaining: number;

  @ApiProperty({ example: 120.5, description: 'Acquisition cost per unit' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiProperty({ example: 150, description: 'Selling price per unit' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice: number;
}
