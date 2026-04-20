import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, StaffRole } from '@prisma/client';

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

  @ApiProperty({ enum: AccountType, example: AccountType.HMO })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiProperty({ enum: StaffRole, example: StaffRole.HMO_STAFF })
  @IsEnum(StaffRole)
  staffRole: StaffRole;

  @ApiPropertyOptional({
    example: 'HMO_STAFF',
    description:
      'Legacy alias for staffRole when clients still send role instead of staffRole.',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'department-uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

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
