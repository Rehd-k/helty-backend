import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches } from 'class-validator';
import { MedicalSpecialty } from '@prisma/client';

export class ListDoctorsQueryDto {
  @ApiProperty({ enum: MedicalSpecialty })
  @IsEnum(MedicalSpecialty)
  specialtyId!: MedicalSpecialty;
}

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsString()
  doctorId!: string;

  @ApiProperty({ example: '2024-10-24' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
