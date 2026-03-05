import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class ListManufacturerDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or country' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by country (exact or contains)' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ['name', 'country', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'country', 'createdAt'])
  sortBy?: 'name' | 'country' | 'createdAt' = undefined;
}
