import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListIcd10Dto {
  @ApiPropertyOptional({ description: 'Filter by clinical specialty' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ description: 'Filter by ICD group name' })
  @IsOptional()
  @IsString()
  icdGroup?: string;

  @ApiPropertyOptional({ description: 'Filter by code range label', example: 'I00-I02' })
  @IsOptional()
  @IsString()
  range?: string;

  @ApiPropertyOptional({
    description: 'Optional text filter on code or description',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}
