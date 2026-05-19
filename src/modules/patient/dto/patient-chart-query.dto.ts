import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatientChartQueryDto {
  @ApiPropertyOptional({
    description:
      'Comma-separated sections to include (e.g. encounters,invoices). Omit for profile + summary only.',
    example: 'encounters,invoices',
  })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'ISO date — filter time-based sections (start)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'ISO date — filter time-based sections (end)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
