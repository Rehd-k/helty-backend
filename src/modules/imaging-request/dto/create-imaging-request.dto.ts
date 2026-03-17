import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImagingRequestStatus } from '@prisma/client';

export class CreateImagingRequestDto {
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

  @ApiPropertyOptional({ description: 'Type of imaging study' })
  @IsString()
  @IsOptional()
  studyType?: string;

  @ApiPropertyOptional({ description: 'Modality (e.g. X-ray, CT, MRI)' })
  @IsString()
  @IsOptional()
  modality?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Service UUID to bill for this imaging request (creates invoice with this service)',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;
}

export class UpdateImagingRequestDto {
  @ApiPropertyOptional({ enum: ImagingRequestStatus })
  @IsEnum(ImagingRequestStatus)
  @IsOptional()
  status?: ImagingRequestStatus;

  @ApiPropertyOptional({ description: 'Type of imaging study' })
  @IsString()
  @IsOptional()
  studyType?: string;

  @ApiPropertyOptional({ description: 'Modality (e.g. X-ray, CT, MRI)' })
  @IsString()
  @IsOptional()
  modality?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
