import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReportSeverity } from '@prisma/client';

export class CreateRadiologyReportDto {
  @ApiPropertyOptional({ description: 'Findings' })
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiPropertyOptional({ description: 'Impression' })
  @IsString()
  @IsOptional()
  impression?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsString()
  @IsOptional()
  recommendations?: string;

  @ApiPropertyOptional({ enum: ReportSeverity })
  @IsEnum(ReportSeverity)
  @IsOptional()
  severity?: ReportSeverity;
}

export class UpdateRadiologyReportDto {
  @ApiPropertyOptional({ description: 'Findings' })
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiPropertyOptional({ description: 'Impression' })
  @IsString()
  @IsOptional()
  impression?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsString()
  @IsOptional()
  recommendations?: string;

  @ApiPropertyOptional({ enum: ReportSeverity })
  @IsEnum(ReportSeverity)
  @IsOptional()
  severity?: ReportSeverity;
}
