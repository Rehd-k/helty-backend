import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsObject,
} from 'class-validator';
import {
  NursingNoteType,
  MonitoringChartType,
  ShiftType,
} from '@prisma/client';

export class CreateNursingNoteDto {
  @ApiProperty({ enum: NursingNoteType })
  @IsEnum(NursingNoteType)
  noteType: NursingNoteType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateProcedureRecordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  procedureType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complications?: string;

  @ApiProperty()
  @IsDateString()
  recordedAt: string;
}

export class CreateWoundAssessmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  woundLocation: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  woundSize: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  woundStage: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  exudate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  odor: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  infectionSigns: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreateCarePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problem: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  goal: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  intervention: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  evaluationStatus: string;
}

export class UpdateCarePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  problem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intervention?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluationStatus?: string;
}

export class CreateMonitoringChartDto {
  @ApiProperty({ enum: MonitoringChartType })
  @IsEnum(MonitoringChartType)
  type: MonitoringChartType;

  @ApiProperty({ description: 'Structured payload (e.g. GCS scores)' })
  @IsObject()
  value: Record<string, unknown>;

  @ApiProperty()
  @IsDateString()
  recordedAt: string;
}

export class UpdateMonitoringChartDto {
  @ApiPropertyOptional({ enum: MonitoringChartType })
  @IsOptional()
  @IsEnum(MonitoringChartType)
  type?: MonitoringChartType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class CreateHandoverReportDto {
  @ApiProperty({ enum: ShiftType })
  @IsEnum(ShiftType)
  shiftType: ShiftType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  summary: string;
}
