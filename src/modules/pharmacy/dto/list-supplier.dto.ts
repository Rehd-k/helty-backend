import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class ListSupplierDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or license' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter blacklisted suppliers' })
  @IsOptional()
  @IsBooleanString()
  isBlacklisted?: string;

  @ApiPropertyOptional({ enum: ['name', 'rating', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'rating', 'createdAt'])
  sortBy?: 'name' | 'rating' | 'createdAt' = undefined;
}
