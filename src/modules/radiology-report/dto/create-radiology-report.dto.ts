import {
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateRadiologyReportDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  reportType: string;

  @IsString()
  @IsNotEmpty()
  results: string;
}

export class UpdateRadiologyReportDto {
  @IsString()
  @IsOptional()
  reportType?: string;

  @IsString()
  @IsOptional()
  results?: string;
}
