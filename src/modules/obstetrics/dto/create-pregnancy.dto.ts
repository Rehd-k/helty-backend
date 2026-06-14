import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PregnancyStatus } from '@prisma/client';
import {
  BLOOD_GROUP_OPTIONS,
  GENOTYPE_OPTIONS,
  SEROLOGY_RESULT_OPTIONS,
  URINE_DIPSTICK_OPTIONS,
} from '../obstetrics.constants';

class PregnancyBookingFieldsDto {
  @ApiPropertyOptional({ description: 'Respiratory rate (breaths/min)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Heart rate (bpm)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Systolic BP (mmHg)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  systolicBP?: number;

  @ApiPropertyOptional({ description: 'Diastolic BP (mmHg)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  diastolicBP?: number;

  @ApiPropertyOptional({ description: 'SpO₂ (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  spo2?: number;

  @ApiPropertyOptional({ enum: GENOTYPE_OPTIONS })
  @IsIn(GENOTYPE_OPTIONS)
  @IsOptional()
  genotype?: (typeof GENOTYPE_OPTIONS)[number];

  @ApiPropertyOptional({ enum: BLOOD_GROUP_OPTIONS })
  @IsIn(BLOOD_GROUP_OPTIONS)
  @IsOptional()
  bloodGroup?: (typeof BLOOD_GROUP_OPTIONS)[number];

  @ApiPropertyOptional({ description: 'Packed cell volume (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  pcv?: number;

  @ApiPropertyOptional({ enum: SEROLOGY_RESULT_OPTIONS })
  @IsIn(SEROLOGY_RESULT_OPTIONS)
  @IsOptional()
  hcv?: (typeof SEROLOGY_RESULT_OPTIONS)[number];

  @ApiPropertyOptional({ enum: SEROLOGY_RESULT_OPTIONS })
  @IsIn(SEROLOGY_RESULT_OPTIONS)
  @IsOptional()
  hbsAg?: (typeof SEROLOGY_RESULT_OPTIONS)[number];

  @ApiPropertyOptional({ enum: SEROLOGY_RESULT_OPTIONS })
  @IsIn(SEROLOGY_RESULT_OPTIONS)
  @IsOptional()
  vdrl?: (typeof SEROLOGY_RESULT_OPTIONS)[number];

  @ApiPropertyOptional({ enum: SEROLOGY_RESULT_OPTIONS })
  @IsIn(SEROLOGY_RESULT_OPTIONS)
  @IsOptional()
  hiv12?: (typeof SEROLOGY_RESULT_OPTIONS)[number];

  @ApiPropertyOptional({ enum: URINE_DIPSTICK_OPTIONS })
  @IsIn(URINE_DIPSTICK_OPTIONS)
  @IsOptional()
  urinalysisProtein?: (typeof URINE_DIPSTICK_OPTIONS)[number];

  @ApiPropertyOptional({ enum: URINE_DIPSTICK_OPTIONS })
  @IsIn(URINE_DIPSTICK_OPTIONS)
  @IsOptional()
  urinalysisGlucose?: (typeof URINE_DIPSTICK_OPTIONS)[number];

  @ApiPropertyOptional({
    description: 'Tetanus toxoid immunization status (e.g. TT1, TT2)',
  })
  @IsString()
  @IsOptional()
  ttImmunization?: string;
}

export class CreatePregnancyDto extends PregnancyBookingFieldsDto {
  @ApiProperty()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  gravida: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  para: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  lmp: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  edd: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  bookingDate?: string;

  @ApiPropertyOptional({ enum: PregnancyStatus })
  @IsEnum(PregnancyStatus)
  @IsOptional()
  status?: PregnancyStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  outcome?: string;
}

export class UpdatePregnancyDto extends PregnancyBookingFieldsDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  gravida?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  para?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  lmp?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  edd?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  bookingDate?: string;

  @ApiPropertyOptional({ enum: PregnancyStatus })
  @IsEnum(PregnancyStatus)
  @IsOptional()
  status?: PregnancyStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  outcome?: string;
}
