import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from '../../billing-analytics/billing-analytics-period';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';
import { FINANCE_AUDIT_ENTITIES } from '../accounts.constants';

export class AccountsPeriodQueryDto {
  @ApiProperty({ enum: [...ANALYTICS_PERIODS], example: 'month' })
  @IsIn([...ANALYTICS_PERIODS])
  period!: AnalyticsPeriod;

  @ApiPropertyOptional({ description: 'Anchor instant (ISO 8601). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class AccountsDateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AccountsAuditLogsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ enum: [...FINANCE_AUDIT_ENTITIES] })
  @IsOptional()
  @IsIn([...FINANCE_AUDIT_ENTITIES])
  entity?: string;

  @ApiPropertyOptional({ example: 'PAYMENT_RECEIVED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Staff name, email, or id' })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  override skip?: number = 0;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override take?: number = 50;
}

export class AccountsInvoiceChangesQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ description: 'Search invoice number or change detail' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  override skip?: number = 0;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override take?: number = 50;
}

export class AccountsAgingQueryDto {
  @ApiPropertyOptional({ enum: ['hmo', 'discount', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['hmo', 'discount', 'all'])
  type?: 'hmo' | 'discount' | 'all' = 'all';
}

export class AccountsRevenueByServiceDetailsQueryDto extends AccountsPeriodQueryDto {
  @ApiProperty({
    description: 'Exact serviceCategory label from the revenue-by-service summary row',
    example: 'Laboratory',
  })
  @IsString()
  serviceCategory!: string;

  @ApiPropertyOptional({
    description: 'Search patient name, hospital patientId, phone, or invoice number',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}
