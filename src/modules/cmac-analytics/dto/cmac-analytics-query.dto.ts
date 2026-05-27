import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from '../../billing-analytics/billing-analytics-period';

export class CmacAnalyticsQueryDto {
  @ApiProperty({ enum: [...ANALYTICS_PERIODS], example: 'month' })
  @IsIn([...ANALYTICS_PERIODS])
  period!: AnalyticsPeriod;

  @ApiPropertyOptional({ description: 'Anchor instant (ISO 8601). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
