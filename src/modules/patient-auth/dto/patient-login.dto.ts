import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PatientDeviceFieldsDto } from './patient-device-fields.dto';

export class PatientLoginDto extends PatientDeviceFieldsDto {
  @ApiProperty({ example: '08030000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description:
      'Short-lived proof from activate/verify. Required when this phone is not verified yet.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceProof?: string;
}
