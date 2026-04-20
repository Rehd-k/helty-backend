import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { AlertSeverity } from '@prisma/client';

export class CreateAlertLogDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  alertType: string;

  @ApiProperty({ enum: AlertSeverity })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ResolveAlertLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;
}
