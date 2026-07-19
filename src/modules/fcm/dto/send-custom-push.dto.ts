import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SendCustomPushDto {
  @ApiProperty({ example: 'Clinic update' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Our OPD will open at 9am tomorrow.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/notices/opd.png',
    description: 'Public HTTPS image URL shown in the push notification',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Patient UUIDs to target. Omit or pass empty to notify all patients with a registered device.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  patientIds?: string[];
}
