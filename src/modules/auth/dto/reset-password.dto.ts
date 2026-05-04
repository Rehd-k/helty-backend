import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'staff@hospital.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit code from email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'newSecret1', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
