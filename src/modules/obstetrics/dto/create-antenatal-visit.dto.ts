import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FetalPresentation } from '@prisma/client';

export class CreateAntenatalVisitDto {
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

export class UpdateAntenatalVisitDto {
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
