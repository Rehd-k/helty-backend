import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendLabResultsToPatientDto {
  @ApiProperty({ description: 'Patient UUID. Email and phone are loaded from this record.' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({
    description:
      'Lab order item UUIDs included in this report (used to reuse a cached PDF).',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderItemIds: string[];

  @ApiProperty({ description: 'Email the laboratory report PDF to the patient.' })
  @IsBoolean()
  sendEmail: boolean;

  @ApiProperty({
    description:
      'Send laboratory results to the patient phone (WhatsApp template; optional SMS text).',
  })
  @IsBoolean()
  sendSms: boolean;

  @ApiPropertyOptional({
    description:
      'Base64 PDF of the laboratory report. Required when no cached report exists for these items.',
  })
  @IsOptional()
  @IsString()
  pdfBase64?: string;

  @ApiPropertyOptional({
    description:
      'Optional plain-text SMS alongside WhatsApp when sendSms is true.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  smsText?: string;
}
