import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsIn,
  IsDateString,
} from 'class-validator';
import { MedicationAdminStatus } from '@prisma/client';

const MEDICATION_ROUTES = ['IV', 'ORAL', 'IM', 'SC'] as const;
const ADMINISTRATION_LIFECYCLE_STATUSES = ['ACTIVE', 'STOPPED'] as const;

export class CreateAdmissionMedicationOrderDto {
  @ApiProperty({ enum: MEDICATION_ROUTES })
  @IsIn(MEDICATION_ROUTES)
  route: (typeof MEDICATION_ROUTES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  drugName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dose: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frequency: string;

  @ApiProperty()
  @IsDateString()
  startDateTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAdmissionMedicationOrderDto {
  @ApiPropertyOptional({ enum: ADMINISTRATION_LIFECYCLE_STATUSES })
  @IsOptional()
  @IsIn(ADMINISTRATION_LIFECYCLE_STATUSES)
  administrationStatus?: (typeof ADMINISTRATION_LIFECYCLE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMedicationAdministrationDto {
  @ApiProperty()
  @IsUUID()
  medicationOrderId: string;

  @ApiProperty()
  @IsDateString()
  scheduledTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualTime?: string;

  @ApiProperty({ enum: MedicationAdminStatus })
  @IsIn(Object.values(MedicationAdminStatus))
  status: MedicationAdminStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonIfNotGiven?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateMedicationAdministrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualTime?: string;

  @ApiPropertyOptional({ enum: MedicationAdminStatus })
  @IsOptional()
  @IsIn(Object.values(MedicationAdminStatus))
  status?: MedicationAdminStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonIfNotGiven?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
