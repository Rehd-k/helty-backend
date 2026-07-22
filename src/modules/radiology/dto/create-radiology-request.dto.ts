import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyPriority, RadiologyModality } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateRadiologyOrderItemDto {
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
    description: 'Whether contrast is required for this study',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  contrast?: boolean;

  @ApiPropertyOptional({
    description:
      'Invoice UUID — use with invoiceItemId and serviceId for paid counter flow. Outpatients: line must be on a paid invoice at order time.',
  })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description:
      'Radiology & Imaging invoice line item UUID (paid counter flow)',
  })
  @IsUUID()
  @IsOptional()
  invoiceItemId?: string;

  @ApiPropertyOptional({
    description:
      'Radiology & Imaging service UUID — with encounterId, creates a pending encounter invoice line for any patient. Outpatients must pay before reports/images are entered; inpatients on active admission may receive results on credit. Otherwise use with invoiceId and invoiceItemId (paid counter flow).',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({
    description:
      'When true with a package-covered serviceId, bills at zero via the default antenatal package.',
  })
  @IsBoolean()
  @IsOptional()
  useAntenatalPackage?: boolean;
}

export class CreateRadiologyRequestDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Encounter UUID (optional)' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({
    description:
      'Pregnancy UUID — resolves encounterId from the pregnancy antenatal encounter when encounterId is omitted.',
  })
  @IsUUID()
  @IsOptional()
  pregnancyId?: string;

  @ApiProperty({ description: 'Staff UUID of the ordering doctor' })
  @IsUUID()
  @IsNotEmpty()
  requestedById: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({
    type: [CreateRadiologyOrderItemDto],
    description: 'At least one radiology order item',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateRadiologyOrderItemDto)
  items: CreateRadiologyOrderItemDto[];
}
