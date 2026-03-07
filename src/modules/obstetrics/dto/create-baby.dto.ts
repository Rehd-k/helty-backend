import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BabySex } from '@prisma/client';

export class CreateBabyDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  labourDeliveryId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  motherId: string;

  @ApiProperty({ enum: BabySex })
  @IsEnum(BabySex)
  sex: BabySex;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  birthWeightG?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  birthLengthCm?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  apgar1?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  apgar5?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resuscitation?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  birthOrder?: number = 1;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  createdById?: string;
}

export class UpdateBabyDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  birthWeightG?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  birthLengthCm?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  apgar1?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  apgar5?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resuscitation?: string;
}

export class RegisterBabyAsPatientDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  surname: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  otherName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gender?: string;
}
