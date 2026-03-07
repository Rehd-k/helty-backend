import {
  IsString,
  IsInt,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMode, DeliveryOutcome } from '@prisma/client';

export class CreateLabourDeliveryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  pregnancyId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  deliveryDateTime: string;

  @ApiProperty({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  mode: DeliveryMode;

  @ApiProperty({ enum: DeliveryOutcome })
  @IsEnum(DeliveryOutcome)
  outcome: DeliveryOutcome;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  bloodLossMl?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  placentaComplete?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  episiotomy?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  perinealTearGrade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  deliveredById: string;
}

export class UpdateLabourDeliveryDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  deliveryDateTime?: string;

  @ApiPropertyOptional({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  @IsOptional()
  mode?: DeliveryMode;

  @ApiPropertyOptional({ enum: DeliveryOutcome })
  @IsEnum(DeliveryOutcome)
  @IsOptional()
  outcome?: DeliveryOutcome;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  bloodLossMl?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  placentaComplete?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  episiotomy?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  perinealTearGrade?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
