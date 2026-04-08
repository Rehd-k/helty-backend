import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePatientVitalsDto {
  @ApiPropertyOptional({ description: 'Patient UUID the vitals belong to' })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({
    description:
      'Waiting patient UUID (outpatient queue). Mutually exclusive with admissionId.',
  })
  @IsString()
  @IsOptional()
  waitingPatientId?: string;

  @ApiPropertyOptional({
    description:
      'Admission UUID for an admitted patient. Mutually exclusive with waitingPatientId.',
  })
  @IsString()
  @IsOptional()
  admissionId?: string;

  @ApiPropertyOptional({
    description:
      'Invoice UUID for outpatient paid queue flow. Mutually exclusive with waitingPatientId and admissionId.',
  })
  @IsString()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Systolic blood pressure in mmHg',
    example: 120,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  systolic?: number;

  @ApiPropertyOptional({
    description: 'Diastolic blood pressure in mmHg',
    example: 80,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  diastolic?: number;

  @ApiPropertyOptional({
    description: 'Body temperature in °C',
    example: 36.7,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Height in centimeters',
    example: 170.5,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    description: 'Weight in kilograms',
    example: 70.2,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({
    description: 'Body Mass Index',
    example: 24.3,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bmi?: number;

  @ApiPropertyOptional({
    description: 'Pulse rate in beats per minute',
    example: 72,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  pulseRate?: number;

  @ApiPropertyOptional({
    description: 'Oxygen saturation (SpO₂) percentage',
    example: 98,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  spo2?: number;

  @ApiPropertyOptional({
    description: 'Pain score (e.g. 0-10)',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  painScore?: number;

  @ApiPropertyOptional({ description: 'Free-text notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Blood glucose level in mg/dL',
    example: 24.3,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bloodGlucose?: number;
}

export class UpdatePatientVitalsDto {
  @ApiPropertyOptional({
    description: 'Patient UUID to reassign these vitals to',
  })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Systolic blood pressure in mmHg',
    example: 120,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  systolic?: number;

  @ApiPropertyOptional({
    description: 'Diastolic blood pressure in mmHg',
    example: 80,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  diastolic?: number;

  @ApiPropertyOptional({
    description: 'Body temperature in °C',
    example: 36.7,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Height in centimeters',
    example: 170.5,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    description: 'Weight in kilograms',
    example: 70.2,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({
    description: 'Body Mass Index',
    example: 24.3,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bmi?: number;

  @ApiPropertyOptional({
    description: 'Blood glucose level in mg/dL',
    example: 24.3,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  bloodGlucose?: number;

  @ApiPropertyOptional({
    description: 'Pulse rate in beats per minute',
    example: 72,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  pulseRate?: number;

  @ApiPropertyOptional({
    description: 'Oxygen saturation (SpO₂) percentage',
    example: 98,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  spo2?: number;
}

export class QueryPatientVitalsDto {
  @ApiPropertyOptional({
    description: 'Filter vitals by patient UUID',
  })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;
}
