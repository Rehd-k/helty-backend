import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from '../billing-analytics-period';

export class BillingAnalyticsQueryDto {
  @ApiProperty({ enum: [...ANALYTICS_PERIODS], example: 'month' })
  @IsIn([...ANALYTICS_PERIODS])
  period!: AnalyticsPeriod;

  @ApiPropertyOptional({
    description:
      'Anchor instant for period boundaries (ISO 8601). Defaults to now. Used for tests.',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class RecentInvoicesQueryDto extends BillingAnalyticsQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export class ComparisonMetricsDto {
  @ApiProperty()
  current!: number;

  @ApiProperty()
  previous!: number;

  @ApiProperty({
    nullable: true,
    description:
      'Null when previous is 0 and change is undefined; 100 when current > 0 and previous === 0.',
  })
  percentChange!: number | null;

  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  direction!: 'up' | 'down' | 'flat';
}
