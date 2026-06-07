import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchaseItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiPropertyOptional({
    description: 'Patient-facing selling price. 0 means the item is free.',
    example: 1500,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}

export class UpdatePurchaseItemDto extends PartialType(CreatePurchaseItemDto) {}

export class SearchPurchaseItemDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inStock?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lowStock?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiringSoon?: string;
}
