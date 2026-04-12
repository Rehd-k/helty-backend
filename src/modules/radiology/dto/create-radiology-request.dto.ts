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

  @ApiPropertyOptional({
    description:
      'Radiology & Imaging service UUID — with encounterId, a pending invoice line is created automatically; otherwise use together with invoiceId and invoiceItemId when billing was settled at the counter',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;
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
