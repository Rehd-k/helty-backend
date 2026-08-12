import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LabTestFieldType } from '@prisma/client';

export const LAB_CONFIG_FORMAT = 'helty-lab-config';
export const LAB_CONFIG_VERSION = 1;

export class ImportLabConfigFieldDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: LabTestFieldType })
  @IsEnum(LabTestFieldType)
  fieldType: LabTestFieldType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceRange?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  optionsJson?: string | null;
}

export class ImportLabConfigVersionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNumber: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [ImportLabConfigFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigFieldDto)
  fields: ImportLabConfigFieldDto[];
}

export class ImportLabConfigTestDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sampleType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [ImportLabConfigVersionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigVersionDto)
  versions: ImportLabConfigVersionDto[];
}

export class ImportLabConfigCategoryDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ type: [ImportLabConfigTestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigTestDto)
  tests: ImportLabConfigTestDto[];
}

export class ImportLabConfigAntibioticDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class ImportLabConfigAstOptionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class ImportLabConfigDto {
  @ApiProperty({ example: LAB_CONFIG_FORMAT })
  @IsString()
  @Equals(LAB_CONFIG_FORMAT)
  format: string;

  @ApiProperty({ example: LAB_CONFIG_VERSION })
  @Type(() => Number)
  @IsInt()
  @Equals(LAB_CONFIG_VERSION)
  version: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exportedAt?: string;

  @ApiProperty({ type: [ImportLabConfigCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigCategoryDto)
  categories: ImportLabConfigCategoryDto[];

  @ApiProperty({ type: [ImportLabConfigAntibioticDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigAntibioticDto)
  antibiotics: ImportLabConfigAntibioticDto[];

  @ApiProperty({ type: [ImportLabConfigAstOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLabConfigAstOptionDto)
  astResultOptions: ImportLabConfigAstOptionDto[];
}
