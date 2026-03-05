import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class ListPharmacyLocationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PharmacyLocationType })
  @IsOptional()
  @IsEnum(PharmacyLocationType)
  locationType?: PharmacyLocationType;

  @ApiPropertyOptional({ enum: ['name', 'locationType', 'createdAt'] })
  @IsOptional()
  @IsIn(['name', 'locationType', 'createdAt'])
  sortBy?: 'name' | 'locationType' | 'createdAt' = undefined;
}
