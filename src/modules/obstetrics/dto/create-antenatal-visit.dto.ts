import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FetalPresentation } from '@prisma/client';
import { FETAL_DESCENT_OPTIONS } from '../obstetrics.constants';

class AntenatalVisitClinicalFieldsDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  gestationDays?: number;

  @ApiPropertyOptional({ enum: FETAL_DESCENT_OPTIONS })
  @IsIn(FETAL_DESCENT_OPTIONS)
  @IsOptional()
  descent?: (typeof FETAL_DESCENT_OPTIONS)[number];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  urineGlucose?: string;

  @ApiPropertyOptional({ description: 'Packed cell volume (%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  pcv?: number;
}

export class CreateAntenatalVisitDto extends AntenatalVisitClinicalFieldsDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  pregnancyId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  visitDate: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  gestationWeeks?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  systolicBP?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  diastolicBP?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  fundalHeight?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  fetalHeartRate?: number;

  @ApiPropertyOptional({ enum: FetalPresentation })
  @IsEnum(FetalPresentation)
  @IsOptional()
  presentation?: FetalPresentation;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  urineProtein?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ultrasoundFindings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  labResultsJson?: object;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  staffId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  encounterId?: string;
}

export class UpdateAntenatalVisitDto extends AntenatalVisitClinicalFieldsDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  visitDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  gestationWeeks?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  systolicBP?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  diastolicBP?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  fundalHeight?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  fetalHeartRate?: number;

  @ApiPropertyOptional({ enum: FetalPresentation })
  @IsEnum(FetalPresentation)
  @IsOptional()
  presentation?: FetalPresentation;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  urineProtein?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ultrasoundFindings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  labResultsJson?: object;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  encounterId?: string;
}
