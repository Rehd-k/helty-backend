import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostnatalVisitType } from '@prisma/client';

export class CreatePostnatalVisitDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  labourDeliveryId: string;

  @ApiProperty({ enum: PostnatalVisitType })
  @IsEnum(PostnatalVisitType)
  type: PostnatalVisitType;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  visitDate: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  babyId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  uterusInvolution?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lochia?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  perineum?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bloodPressure?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breastfeeding?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feeding?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  jaundice?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  immunisationGiven?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  staffId: string;
}

export class UpdatePostnatalVisitDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  visitDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  uterusInvolution?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lochia?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  perineum?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bloodPressure?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breastfeeding?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feeding?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  jaundice?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  immunisationGiven?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
