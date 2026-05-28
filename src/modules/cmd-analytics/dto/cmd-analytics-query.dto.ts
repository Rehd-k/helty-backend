import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from '../../billing-analytics/billing-analytics-period';

export class CmdAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: [...ANALYTICS_PERIODS], default: 'today' })
  @IsOptional()
  @IsIn([...ANALYTICS_PERIODS])
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({ description: 'Anchor instant (ISO 8601). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
