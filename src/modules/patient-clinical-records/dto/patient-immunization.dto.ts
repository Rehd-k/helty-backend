import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePatientImmunizationDto {
  @ApiProperty({ example: 'Tetanus toxoid' })
  @IsString()
  @MaxLength(200)
  vaccineName!: string;

  @ApiPropertyOptional({ example: 'Dose 1 of 3' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doseNumber?: number;

  @ApiProperty({ example: '2026-03-12T10:00:00.000Z' })
  @IsDateString()
  administeredAt!: string;
}

export class UpdatePatientImmunizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vaccineName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doseNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  administeredAt?: string;
}

export class PatientImmunizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  patientId!: string;

  @ApiProperty()
  vaccineName!: string;

  @ApiPropertyOptional()
  detail?: string | null;

  @ApiPropertyOptional()
  doseNumber?: number | null;

  @ApiProperty()
  administeredAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
