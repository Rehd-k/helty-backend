import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PatientDeviceFieldsDto } from './patient-device-fields.dto';

export class PatientActivateRequestDto {
  @ApiProperty({ example: '08030000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber: string;

  @ApiProperty({ example: '1990-05-15', description: 'Date of birth (YYYY-MM-DD)' })
  @IsDateString({ strict: true }, { message: 'dob must be YYYY-MM-DD' })
  dob: string;
}

export class PatientActivateVerifyDto {
  @ApiProperty({ example: '08030000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  code: string;
}

export class PatientActivatePasswordDto extends PatientDeviceFieldsDto {
  @ApiProperty({ description: 'Token returned by activate/verify' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  setupToken: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
