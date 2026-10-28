import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PatientDeviceFieldsDto } from './patient-device-fields.dto';

export class PatientForgotPasswordRequestDto {
  @ApiProperty({ example: '08030000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber: string;

  @ApiProperty({ example: '1990-05-15' })
  @IsDateString({ strict: true }, { message: 'dob must be YYYY-MM-DD' })
  dob: string;
}

export class PatientForgotPasswordResetDto extends PatientDeviceFieldsDto {
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

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
