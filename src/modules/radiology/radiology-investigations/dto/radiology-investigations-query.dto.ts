import {
  IsOptional,
  IsUUID,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyPriority, RadiologyRequestStatus } from '@prisma/client';
import { SortOrder } from '../../../../common/dto/sort-order.dto';

export enum RadiologyInvestigationsSortBy {
  createdAt = 'createdAt',
  testName = 'testName',
  amount = 'amount',
  patientName = 'patientName',
  status = 'status',
}

export class RadiologyInvestigationsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Partial match on scan type, body part, or service name',
  })
  @IsOptional()
  @IsString()
  testName?: string;

  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsOptional()
  @IsEnum(RadiologyRequestStatus)
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional({ description: 'Filter by requesting department UUID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: RadiologyPriority })
  @IsOptional()
  @IsEnum(RadiologyPriority)
  priority?: RadiologyPriority;

  @ApiPropertyOptional({
    enum: RadiologyInvestigationsSortBy,
    default: 'createdAt',
  })
  @IsOptional()
  @IsEnum(RadiologyInvestigationsSortBy)
  sortBy?: RadiologyInvestigationsSortBy =
    RadiologyInvestigationsSortBy.createdAt;

  @ApiPropertyOptional({ enum: SortOrder, default: 'desc' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}
