import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
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

  @ApiProperty({ description: 'Email the laboratory report PDF to the patient.' })
  @IsBoolean()
  sendEmail: boolean;

  @ApiProperty({ description: 'Text the laboratory results to the patient.' })
  @IsBoolean()
  sendSms: boolean;

  @ApiPropertyOptional({
    description: 'Base64 PDF of the laboratory report, required when sendEmail is true.',
  })
  @IsOptional()
  @IsString()
  pdfBase64?: string;

  @ApiPropertyOptional({
    description: 'Plain-text results, required when sendSms is true.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  smsText?: string;
}
