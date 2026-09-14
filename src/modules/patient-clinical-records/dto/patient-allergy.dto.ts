import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const ALLERGY_SEVERITIES = [
  'MILD',
  'MODERATE',
  'SEVERE',
  'CRITICAL',
] as const;

export class CreatePatientAllergyDto {
  @ApiProperty({ example: 'Penicillin' })
  @IsString()
  @MaxLength(200)
  allergen!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsString()
  @IsIn(ALLERGY_SEVERITIES)
  severity?: (typeof ALLERGY_SEVERITIES)[number];

  @ApiPropertyOptional({ example: 'DRUG' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePatientAllergyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  allergen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsString()
  @IsIn(ALLERGY_SEVERITIES)
  severity?: (typeof ALLERGY_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PatientAllergyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  patientId!: string;

  @ApiProperty()
  allergen!: string;

  @ApiPropertyOptional()
  reaction?: string | null;

  @ApiPropertyOptional()
  severity?: string | null;

  @ApiPropertyOptional()
  type?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
