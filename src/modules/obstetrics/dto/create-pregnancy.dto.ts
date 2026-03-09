import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PregnancyStatus } from '@prisma/client';

export class CreatePregnancyDto {

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

export class UpdatePregnancyDto {
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
