import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class ListConsumableDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or category' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ['name', 'category', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'category', 'createdAt'])
  sortBy?: 'name' | 'category' | 'createdAt' = undefined;
}
