import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyRequestStatus } from '@prisma/client';

export class ListRadiologyRequestsQueryDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter requests from this date (ISO)' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter requests until this date (ISO)' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

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
