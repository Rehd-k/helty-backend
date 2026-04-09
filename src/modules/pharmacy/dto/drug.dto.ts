import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DrugPriceDto {
  @ApiProperty()
  @IsUUID()
  wardId: string;

  @ApiProperty({ example: '1500.00' })
  @IsNumber()
  price: number;
}

export class CreateDrugDto {
  @ApiProperty({ example: 'Paracetamol' })
  @IsString()
  genericName: string;

  @ApiProperty({ example: 'DRG001' })
  @IsOptional()
  searviceCode: string;

  @ApiProperty({ example: 'Panadol' })
  @IsString()
  brandName: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional({ example: 'Tablet' })
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiPropertyOptional({ example: 'Oral' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  therapeuticClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  atcCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  manufacturerId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isControlled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRefrigerated?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isHighAlert?: boolean;

  @ApiPropertyOptional({ example: '4000' })
  @IsOptional()
  @IsNumber()
  maxDailyDose?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiPropertyOptional({ type: [DrugPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrugPriceDto)
  prices?: DrugPriceDto[];
}

export class UpdateDrugDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genericName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  searviceCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strength?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dosageForm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  therapeuticClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  atcCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  manufacturerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isControlled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRefrigerated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isHighAlert?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxDailyDose?: number | null;

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

  @ApiPropertyOptional({ type: [DrugPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrugPriceDto)
  prices?: DrugPriceDto[];
}
