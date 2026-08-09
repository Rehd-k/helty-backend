import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum ReportExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XLSX = 'xlsx',
}

export enum RequestsByWardType {
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  PHARMACY = 'pharmacy',
}

export class ReportDateRangeQueryDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    enum: ReportExportFormat,
    default: ReportExportFormat.JSON,
  })
  @IsOptional()
  @IsEnum(ReportExportFormat)
  format?: ReportExportFormat = ReportExportFormat.JSON;
}

export class WardAdmissionsReportQueryDto extends ReportDateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by ward UUID' })
  @IsOptional()
  @IsUUID()
  wardId?: string;
}

export class RequestsByWardReportQueryDto extends ReportDateRangeQueryDto {
  @ApiProperty({ enum: RequestsByWardType })
  @IsIn(['lab', 'radiology', 'pharmacy'])
  type!: 'lab' | 'radiology' | 'pharmacy';
}
