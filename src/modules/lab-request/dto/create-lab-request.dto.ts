import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LabRequestStatus } from '@prisma/client';

export class CreateLabRequestDto {
  @ApiProperty({ description: 'Encounter UUID' })
  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @ApiProperty({ description: 'Patient UUID (must match encounter patient)' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Staff UUID of the requesting doctor' })
  @IsUUID()
  @IsNotEmpty()
  requestedByDoctorId: string;

  @ApiPropertyOptional({ description: 'Type of lab test' })
  @IsString()
  @IsOptional()
  testType?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Service UUID to bill for this lab request (creates invoice with this service)',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;
}

export class UpdateLabRequestDto {
  @ApiPropertyOptional({ enum: LabRequestStatus })
  @IsEnum(LabRequestStatus)
  @IsOptional()
  status?: LabRequestStatus;

  @ApiPropertyOptional({ description: 'Type of lab test' })
  @IsString()
  @IsOptional()
  testType?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
