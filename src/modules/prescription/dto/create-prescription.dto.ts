import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { PrescriptionStatus, PrescriptionType } from '@prisma/client';

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsEnum(PrescriptionType)
  @IsOptional()
  type?: PrescriptionType;

  @IsString()
  @IsNotEmpty()
  drug: string;

  @IsString()
  @IsNotEmpty()
  dosage: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePrescriptionDto {
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsEnum(PrescriptionType)
  @IsOptional()
  type?: PrescriptionType;

  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;

  @IsString()
  @IsOptional()
  drug?: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
