import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEncounterDiagnosisDto {

  @ApiProperty({ description: 'ICD-10 code' })
  @IsString()
  @IsNotEmpty()
  primaryIcdCode: string;

  @ApiProperty({ description: 'ICD-10 description' })
  @IsString()
  @IsNotEmpty()
  primaryIcdDescription: string;

  @ApiProperty({ description: 'Secondary diagnoses JSON' })
  @IsString()
  @IsNotEmpty()
  secondaryDiagnosesJson: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary diagnosis', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateEncounterDiagnosisDto {
  @ApiProperty({ description: 'Diagnosis code or text' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  diagnosis: string;

  @ApiProperty({ description: 'ICD-10 code' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  primaryIcdCode: string;

  @ApiProperty({ description: 'ICD-10 description' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  primaryIcdDescription: string;

  @ApiProperty({ description: 'Secondary diagnoses JSON' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  secondaryDiagnosesJson: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary diagnosis', default: false })
  @IsBoolean()
  @IsOptional()
  @IsOptional()
  isPrimary?: boolean;
}
