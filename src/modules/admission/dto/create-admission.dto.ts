import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CreateAdmissionDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @IsDateString()
  admissionDate: string;

  @IsDateString()
  @IsOptional()
  dischargeDate?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsUUID()
  @IsNotEmpty()
  createdById: string;
}

export class UpdateAdmissionDto {
  @IsDateString()
  @IsOptional()
  dischargeDate?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
