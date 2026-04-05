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

  @IsUUID()
  @IsNotEmpty()
  wardId: string;

  @IsUUID()
  @IsNotEmpty()
  bedId: string;

  @IsDateString()
  @IsOptional()
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
  @IsOptional()
  createdById: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;
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

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;
}
