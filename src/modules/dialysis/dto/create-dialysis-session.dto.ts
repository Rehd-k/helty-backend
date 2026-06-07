import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDialysisSessionDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({ description: 'Requesting physician (staff) UUID' })
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @ApiPropertyOptional({
    description:
      'Invoice UUID — use with invoiceItemId and serviceId to link a billed dialysis line.',
  })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Dialysis invoice line item UUID from the paid counter flow',
  })
  @IsUUID()
  @IsOptional()
  invoiceItemId?: string;

  @ApiPropertyOptional({
    description:
      'Service UUID on the invoice line (must match the billed dialysis service)',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Free-text session notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
