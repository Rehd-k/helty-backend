import {
  IsString,
  IsInt,
  IsNumber,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartogramEntryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  labourDeliveryId: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  recordedAt: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  cervicalDilationCm?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  station?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  contractionsPer10Min?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  fetalHeartRate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  moulding?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descent?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  oxytocin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  recordedById: string;
}
