import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RadiologyModality,
  RadiologyPriority,
  RadiologyRequestStatus,
} from '@prisma/client';

export class UpdateRadiologyOrderItemDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reasonForInvestigation?: string;

  @ApiPropertyOptional({ enum: RadiologyPriority })
  @IsEnum(RadiologyPriority)
  @IsOptional()
  priority?: RadiologyPriority;

  @ApiPropertyOptional({ enum: RadiologyModality })
  @IsEnum(RadiologyModality)
  @IsOptional()
  scanType?: RadiologyModality;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bodyPart?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  contrast?: boolean;
}
