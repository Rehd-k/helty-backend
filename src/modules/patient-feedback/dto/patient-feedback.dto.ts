import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PatientFeedbackKind, PatientFeedbackStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreatePatientFeedbackDto {
  @ApiProperty({ enum: PatientFeedbackKind })
  @IsEnum(PatientFeedbackKind)
  kind!: PatientFeedbackKind;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdatePatientFeedbackDto extends PartialType(
  CreatePatientFeedbackDto,
) {}

export class ListPatientFeedbackQueryDto {
  @ApiPropertyOptional({ enum: PatientFeedbackKind })
  @IsOptional()
  @IsEnum(PatientFeedbackKind)
  kind?: PatientFeedbackKind;

  @ApiPropertyOptional({ enum: PatientFeedbackStatus })
  @IsOptional()
  @IsEnum(PatientFeedbackStatus)
  status?: PatientFeedbackStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
