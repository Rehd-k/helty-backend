import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
