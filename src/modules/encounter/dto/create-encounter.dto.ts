import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EncounterType, EncounterStatus } from '@prisma/client';

export class CreateEncounterDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Staff UUID of the treating doctor' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiPropertyOptional({ description: 'Admission UUID for inpatient review' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty({ enum: EncounterType, description: 'Type of encounter' })
  @IsEnum(EncounterType)
  encounterType: EncounterType;

  @ApiProperty({ description: 'When the encounter started (ISO date string)' })
  @IsDateString()
  startTime: string;

  @ApiPropertyOptional({ description: 'When the encounter ended (ISO date string)' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsString()
  @IsOptional()
  triageNotes?: string;

  @ApiPropertyOptional({ enum: EncounterStatus, default: EncounterStatus.ONGOING })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiProperty({ description: 'Staff UUID of the user creating the record' })
  @IsUUID()
  @IsNotEmpty()
  createdById: string;
}

export class StartOutpatientEncounterDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Staff UUID of the treating doctor' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({
    description: 'Waiting patient entry UUID; if provided, that entry will be marked as seen',
  })
  @IsUUID()
  @IsOptional()
  waitingPatientId?: string;

  @ApiPropertyOptional({ description: 'Staff UUID creating the record (defaults to doctorId)' })
  @IsUUID()
  @IsOptional()
  createdById?: string;
}

export class UpdateEncounterDto {
  @ApiPropertyOptional({ description: 'When the encounter ended (ISO date string)' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsString()
  @IsOptional()
  triageNotes?: string;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional({ description: 'Staff UUID of the user updating the record' })
  @IsUUID()
  @IsOptional()
  updatedById?: string;
}

export class QueryEncounterDto {
  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by doctor (Staff) UUID' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Filter by encounter type', enum: EncounterType })
  @IsEnum(EncounterType)
  @IsOptional()
  encounterType?: EncounterType;

  @ApiPropertyOptional({ description: 'Filter by status', enum: EncounterStatus })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Number of records to return', example: 20 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;
}
