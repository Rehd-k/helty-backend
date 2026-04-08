import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyPriority, RadiologyModality } from '@prisma/client';

export class CreateRadiologyRequestDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Encounter UUID (optional)' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiProperty({ description: 'Staff UUID of the ordering doctor' })
  @IsUUID()
  @IsNotEmpty()
  requestedById: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Clinical notes / reason for investigation',
  })
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional({ description: 'Reason for investigation' })
  @IsString()
  @IsOptional()
  reasonForInvestigation?: string;

  @ApiPropertyOptional({ enum: RadiologyPriority, default: 'ROUTINE' })
  @IsEnum(RadiologyPriority)
  @IsOptional()
  priority?: RadiologyPriority;

  @ApiProperty({ enum: RadiologyModality, description: 'Requested scan type' })
  @IsEnum(RadiologyModality)
  @IsNotEmpty()
  scanType: RadiologyModality;

  @ApiPropertyOptional({ description: 'Body part to be scanned' })
  @IsString()
  @IsOptional()
  bodyPart?: string;

  @ApiPropertyOptional({
    description:
      'Service UUID to bill for this radiology request when ordering from an encounter (creates invoice line). Ignored when paid-invoice linkage fields are all provided.',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({
    description:
      'Invoice UUID — use together with invoiceItemId and serviceId for paid-waiting flow',
  })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Invoice line item UUID (paid Radiology & Imaging line)',
  })
  @IsUUID()
  @IsOptional()
  invoiceItemId?: string;
}
