import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseNoteStatus, PurchaseNotePriority } from '@prisma/client';

export class ListPurchaseNotesQueryDto {
  @ApiPropertyOptional({ enum: PurchaseNoteStatus })
  @IsOptional()
  @IsEnum(PurchaseNoteStatus)
  status?: PurchaseNoteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: PurchaseNotePriority })
  @IsOptional()
  @IsEnum(PurchaseNotePriority)
  priority?: PurchaseNotePriority;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ enum: ['createdAt', 'neededByDate', 'totalEstimatedCost', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'neededByDate', 'totalEstimatedCost', 'status'])
  sortBy?: 'createdAt' | 'neededByDate' | 'totalEstimatedCost' | 'status';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
