import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchasesManufacturerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, unknown>;
}

export class UpdatePurchasesManufacturerDto extends PartialType(
  CreatePurchasesManufacturerDto,
) {}

export class ListPurchasesManufacturerDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
}
