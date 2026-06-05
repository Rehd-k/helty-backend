import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PurchasesLocationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchasesLocationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ enum: PurchasesLocationType })
  @IsEnum(PurchasesLocationType)
  locationType: PurchasesLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePurchasesLocationDto extends PartialType(
  CreatePurchasesLocationDto,
) {}

export class ListPurchasesLocationDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PurchasesLocationType })
  @IsOptional()
  @IsEnum(PurchasesLocationType)
  locationType?: PurchasesLocationType;
}
