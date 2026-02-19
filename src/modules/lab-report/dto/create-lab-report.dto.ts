import {
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateLabReportDto {
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

export class UpdateLabReportDto {
  @IsString()
  @IsOptional()
  reportType?: string;

  @IsString()
  @IsOptional()
  results?: string;
}
