import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CreateRadiologyReportDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsNotEmpty()
  reportType: string;

  @IsString()
  @IsNotEmpty()
  results: string;
}

export class UpdateRadiologyReportDto {
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  reportType?: string;

  @IsString()
  @IsOptional()
  results?: string;
}
