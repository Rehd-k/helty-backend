import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

const HISTORY_STATUSES = [
  PrescriptionStatus.COMPLETED,
  PrescriptionStatus.CANCELLED,
] as const;

export class ListPrescriptionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Comma-separated: COMPLETED, CANCELLED',
    example: 'COMPLETED,CANCELLED',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.split(',').map((s: string) => s.trim().toUpperCase());
  })
  @IsEnum(PrescriptionStatus, { each: true })
  status?: (typeof HISTORY_STATUSES)[number][];
}

export const DEFAULT_HISTORY_STATUSES = [...HISTORY_STATUSES];
