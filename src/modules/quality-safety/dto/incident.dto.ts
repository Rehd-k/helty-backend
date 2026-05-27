import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  SafetyIncidentSeverity,
  SafetyIncidentStatus,
  SafetyIncidentType,
} from '@prisma/client';

export class CreateIncidentDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({ enum: SafetyIncidentType })
  @IsEnum(SafetyIncidentType)
  type!: SafetyIncidentType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: SafetyIncidentSeverity })
  @IsOptional()
  @IsEnum(SafetyIncidentSeverity)
  severity?: SafetyIncidentSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdateIncidentDto extends PartialType(CreateIncidentDto) {
  @ApiPropertyOptional({ enum: SafetyIncidentStatus })
  @IsOptional()
  @IsEnum(SafetyIncidentStatus)
  status?: SafetyIncidentStatus;
}
