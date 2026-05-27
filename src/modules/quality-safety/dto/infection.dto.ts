import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { InfectionCaseStatus, InfectionCaseType } from '@prisma/client';

export class CreateInfectionDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  admissionId!: string;

  @ApiProperty({ enum: InfectionCaseType })
  @IsEnum(InfectionCaseType)
  type!: InfectionCaseType;

  @ApiProperty()
  @IsDateString()
  onsetDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organism?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isolated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdateInfectionDto extends PartialType(CreateInfectionDto) {
  @ApiPropertyOptional({ enum: InfectionCaseStatus })
  @IsOptional()
  @IsEnum(InfectionCaseStatus)
  status?: InfectionCaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resolvedAt?: string;
}
