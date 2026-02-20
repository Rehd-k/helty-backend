import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStaffDto {
  @ApiProperty({ example: 'STAFF-001' })
  @IsString()
  staffId: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'nurse' })
  @IsString()
  role: string;

  @ApiPropertyOptional({ example: 'department-uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'STORE' })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({ example: 'john@hospital.org' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'secretpa55' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}