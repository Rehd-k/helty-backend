import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

export class DrugPriceDto {
  @ApiProperty()
  @IsUUID()
  id: string | undefined;

  @ApiProperty()
  @IsUUID()
  drugId: string | undefined;

  @ApiProperty()
  @IsUUID()
  wardId: string | undefined;

  @ApiProperty({ example: '1500.00' })
  @IsNumberString()
  price: string | undefined;
}

export class CreateDrugPriceDto {
  @ApiProperty({ description: 'Drug ID', example: 'uuid' })
  @IsUUID()
  drugId: string | undefined;

  @ApiProperty({ description: 'Ward ID', example: 'uuid' })
  @IsUUID()
  wardId: string | undefined;

  @ApiProperty({ description: 'Price amount', example: '1200.50' })
  @IsNumberString()
  @Min(0)
  price: string | undefined;
}

export class UpdateDrugPriceDto {
  @ApiPropertyOptional({ description: 'Drug ID', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  drugId?: string;

  @ApiPropertyOptional({ description: 'Ward ID', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional({ description: 'Price amount', example: '1200.50' })
  @IsOptional()
  @IsNumberString()
  @Min(0)
  price?: string;
}

export class SearchDrugPriceDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by drug ID', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  drugId?: string;

  @ApiPropertyOptional({ description: 'Filter by ward ID', example: 'uuid' })
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional({ description: 'Minimum price', example: '1000.00' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price', example: '5000.00' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Optional search term against price/IDs',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
