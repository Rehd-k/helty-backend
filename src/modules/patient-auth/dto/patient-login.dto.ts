import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
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
}
