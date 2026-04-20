import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsDateString,
} from 'class-validator';
import {
  MedicationRoute,
  MedicationOrderStatus,
  MedicationAdminStatus,
} from '@prisma/client';

export class CreateAdmissionMedicationOrderDto {
  @ApiProperty({ enum: MedicationRoute })
  @IsEnum(MedicationRoute)
  route: MedicationRoute;

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
  @ApiPropertyOptional({ enum: MedicationOrderStatus })
  @IsOptional()
  @IsEnum(MedicationOrderStatus)
  status?: MedicationOrderStatus;

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
  @IsEnum(MedicationAdminStatus)
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
  @IsEnum(MedicationAdminStatus)
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
