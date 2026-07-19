import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PatientLoginDto {
  @ApiProperty({
    example: 'AB12CD34',
    description: 'Hospital-issued patient ID',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  patientId: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Date of birth (YYYY-MM-DD)',
  })
  @IsDateString({ strict: true }, { message: 'dob must be YYYY-MM-DD' })
  dob: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Stable device identifier generated once and stored on the device',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceKey: string;

  @ApiPropertyOptional({ example: 'ios', description: 'ios | android | web' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @ApiPropertyOptional({
    example: 'iPhone 15',
    description: 'Human-readable device label',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceLabel?: string;

  @ApiPropertyOptional({
    description: 'FCM registration token for this device (optional at login)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}
