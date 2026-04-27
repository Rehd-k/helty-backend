import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabOrderStatus } from '@prisma/client';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: LabOrderStatus })
  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;

  @ApiPropertyOptional({
    description:
      'Filter orders with createdAt on/after this date (ISO 8601). Start-of-day when used with toDate.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'Filter orders with createdAt on/before this date (ISO 8601). End-of-day when used with fromDate.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Take', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}
