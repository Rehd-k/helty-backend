import {
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateDoctorReportDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

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

  @IsString()
  @IsOptional()
  doctorId?: string;
}
