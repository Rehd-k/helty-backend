import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class CreateLabReportDto {
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

export class UpdateLabReportDto {
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
