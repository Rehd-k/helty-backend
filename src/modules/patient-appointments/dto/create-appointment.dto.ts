import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentVisitType, MedicalSpecialty } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreatePatientAppointmentDto {
  @ApiProperty({
    description: 'Preferred appointment date (date-only YYYY-MM-DD or ISO datetime)',
    example: '2026-08-15',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: MedicalSpecialty })
  @IsEnum(MedicalSpecialty)
  specialty!: MedicalSpecialty;

  @ApiProperty({ enum: AppointmentVisitType })
  @IsEnum(AppointmentVisitType)
  visitType!: AppointmentVisitType;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
