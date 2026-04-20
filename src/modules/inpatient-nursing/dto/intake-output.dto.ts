import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { IntakeOutputType, IntakeOutputCategory } from '@prisma/client';

export class CreateIntakeOutputRecordDto {
  @ApiProperty({ enum: IntakeOutputType })
  @IsEnum(IntakeOutputType)
  type: IntakeOutputType;

  @ApiProperty({ enum: IntakeOutputCategory })
  @IsEnum(IntakeOutputCategory)
  category: IntakeOutputCategory;

  @ApiProperty()
  @IsInt()
  @Min(0)
  amountMl: number;

  @ApiProperty()
  @IsDateString()
  recordedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateIntakeOutputRecordDto {
  @ApiPropertyOptional({ enum: IntakeOutputType })
  @IsOptional()
  @IsEnum(IntakeOutputType)
  type?: IntakeOutputType;

  @ApiPropertyOptional({ enum: IntakeOutputCategory })
  @IsOptional()
  @IsEnum(IntakeOutputCategory)
  category?: IntakeOutputCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  amountMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
