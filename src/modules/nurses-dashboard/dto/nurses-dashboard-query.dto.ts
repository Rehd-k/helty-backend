import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export const NURSE_DASHBOARD_TIME_RANGES = [
  'Today',
  'Last 7 Days',
  'This Month',
  'This Year',
] as const;

export type NurseDashboardTimeRangeDto =
  (typeof NURSE_DASHBOARD_TIME_RANGES)[number];

export class NursesDashboardQueryDto {
  @ApiProperty({
    enum: NURSE_DASHBOARD_TIME_RANGES,
    description: 'Must match Flutter dropdown values exactly.',
  })
  @IsString()
  @IsIn([...NURSE_DASHBOARD_TIME_RANGES])
  timeRange!: NurseDashboardTimeRangeDto;

  @ApiPropertyOptional({
    description:
      'Anchor instant in UTC (ISO 8601). When omitted, the server uses the current time.',
    example: '2026-04-12T14:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
