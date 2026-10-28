import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatientDeviceFieldsDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Stable device identifier generated once and stored on the device',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceKey: string;

  @ApiPropertyOptional({ example: 'android', description: 'ios | android | web' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceLabel?: string;

  @ApiPropertyOptional({
    description: 'FCM registration token for this device',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}
