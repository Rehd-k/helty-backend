import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyRequestStatus, RadiologyPriority, RadiologyModality } from '@prisma/client';

export class UpdateRadiologyRequestDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional({ description: 'Reason for investigation' })
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

  @ApiPropertyOptional({ description: 'Body part to be scanned' })
  @IsString()
  @IsOptional()
  bodyPart?: string;
}
