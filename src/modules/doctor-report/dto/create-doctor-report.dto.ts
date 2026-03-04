import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CreateDoctorReportDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  doctorId?: string;

  @IsString()
  @IsNotEmpty()
  report: string;
}

export class UpdateDoctorReportDto {
  @IsString()
  @IsOptional()
  report?: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  doctorId?: string;
}
