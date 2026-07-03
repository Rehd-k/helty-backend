import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class RadiologyDashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601). Normalized to start-of-day. Defaults to today if omitted.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601). Normalized to end-of-day. Defaults to today if omitted.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
