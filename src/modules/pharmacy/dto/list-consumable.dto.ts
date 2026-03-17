import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class ListConsumableDto extends PaginationDto {
  @ApiProperty({
    description: 'Start date (ISO 8601). Will be normalized to start-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601). Will be normalized to end-of-day.',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate!: string;

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
