import {
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateAdmissionDto {
  @IsString()
  patientId: string;

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
