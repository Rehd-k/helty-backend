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
  @IsOptional()
  startTime: string;

  @ApiPropertyOptional({
    description: 'When the encounter ended (ISO date string)',
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'History of present illness' })
  @IsString()
  @IsOptional()
  hpi?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsString()
  @IsOptional()
  pmh?: string;

  @ApiPropertyOptional({ description: 'Surgical history' })
  @IsString()
  @IsOptional()
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Drug / medication history' })
  @IsString()
  @IsOptional()
  drugHistory?: string;

  @ApiPropertyOptional({ description: 'Allergy history' })
  @IsString()
  @IsOptional()
  allergyHistory?: string;

  @ApiPropertyOptional({ description: 'Family history' })
  @IsString()
  @IsOptional()
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Social history' })
  @IsString()
  @IsOptional()
  socialHistory?: string;

  @ApiPropertyOptional({ description: 'Physical examination notes' })
  @IsString()
  @IsOptional()
  examinationNotes?: string;

  @ApiPropertyOptional({ description: 'SOAP — subjective' })
  @IsString()
  @IsOptional()
  soapSubjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — objective' })
  @IsString()
  @IsOptional()
  soapObjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — assessment' })
  @IsString()
  @IsOptional()
  soapAssessment?: string;

  @ApiPropertyOptional({ description: 'SOAP — plan' })
  @IsString()
  @IsOptional()
  soapPlan?: string;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsString()
  @IsOptional()
  triageNotes?: string;

  @ApiPropertyOptional({
    enum: EncounterStatus,
    default: EncounterStatus.ONGOING,
  })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiProperty({ description: 'Staff UUID of the user creating the record' })
  @IsUUID()
  @IsOptional()
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

  @ApiPropertyOptional({ description: 'History of present illness' })
  @IsString()
  @IsOptional()
  hpi?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsString()
  @IsOptional()
  pmh?: string;

  @ApiPropertyOptional({ description: 'Surgical history' })
  @IsString()
  @IsOptional()
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Drug / medication history' })
  @IsString()
  @IsOptional()
  drugHistory?: string;

  @ApiPropertyOptional({ description: 'Allergy history' })
  @IsString()
  @IsOptional()
  allergyHistory?: string;

  @ApiPropertyOptional({ description: 'Family history' })
  @IsString()
  @IsOptional()
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Social history' })
  @IsString()
  @IsOptional()
  socialHistory?: string;

  @ApiPropertyOptional({ description: 'Physical examination notes' })
  @IsString()
  @IsOptional()
  examinationNotes?: string;

  @ApiPropertyOptional({ description: 'SOAP — subjective' })
  @IsString()
  @IsOptional()
  soapSubjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — objective' })
  @IsString()
  @IsOptional()
  soapObjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — assessment' })
  @IsString()
  @IsOptional()
  soapAssessment?: string;

  @ApiPropertyOptional({ description: 'SOAP — plan' })
  @IsString()
  @IsOptional()
  soapPlan?: string;

  @ApiPropertyOptional({
    description:
      'Waiting patient entry UUID; if provided, that entry will be marked as seen',
  })
  @IsUUID()
  @IsOptional()
  waitingPatientId?: string;

  @ApiPropertyOptional({
    description: 'Staff UUID creating the record (defaults to doctorId)',
  })
  @IsUUID()
  @IsOptional()
  createdById?: string;
}

export class UpdateEncounterDto {
  @ApiPropertyOptional({
    description: 'When the encounter ended (ISO date string)',
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'History of present illness' })
  @IsString()
  @IsOptional()
  hpi?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsString()
  @IsOptional()
  pmh?: string;

  @ApiPropertyOptional({ description: 'Surgical history' })
  @IsString()
  @IsOptional()
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Drug / medication history' })
  @IsString()
  @IsOptional()
  drugHistory?: string;

  @ApiPropertyOptional({ description: 'Allergy history' })
  @IsString()
  @IsOptional()
  allergyHistory?: string;

  @ApiPropertyOptional({ description: 'Family history' })
  @IsString()
  @IsOptional()
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Social history' })
  @IsString()
  @IsOptional()
  socialHistory?: string;

  @ApiPropertyOptional({ description: 'Physical examination notes' })
  @IsString()
  @IsOptional()
  examinationNotes?: string;

  @ApiPropertyOptional({ description: 'SOAP — subjective' })
  @IsString()
  @IsOptional()
  soapSubjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — objective' })
  @IsString()
  @IsOptional()
  soapObjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — assessment' })
  @IsString()
  @IsOptional()
  soapAssessment?: string;

  @ApiPropertyOptional({ description: 'SOAP — plan' })
  @IsString()
  @IsOptional()
  soapPlan?: string;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsString()
  @IsOptional()
  triageNotes?: string;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional({
    description: 'Staff UUID of the user updating the record',
  })
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

  @ApiPropertyOptional({
    description: 'Filter by encounter type',
    enum: EncounterType,
  })
  @IsEnum(EncounterType)
  @IsOptional()
  encounterType?: EncounterType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: EncounterStatus,
  })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;

  @ApiProperty({
    description: 'Start date (ISO 8601). Will be normalized to start-of-day.',
    example: '2025-01-01',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601). Will be normalized to end-of-day.',
    example: '2025-12-31',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate!: string;
}
