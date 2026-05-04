import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  MaxLength,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PatientStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Title {
  MR = 'Mr',
  MRS = 'Mrs',
  MS = 'Ms',
  DR = 'Dr',
  PROF = 'Prof',
  CHIEF = 'Chief',
  HON = 'Hon',
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export enum MaritalStatus {
  SINGLE = 'Single',
  MARRIED = 'Married',
  DIVORCED = 'Divorced',
  WIDOWED = 'Widowed',
  SEPARATED = 'Separated',
}

export class CreatePatientDto {
  @IsEnum(Title)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  surname: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  otherName?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: string;

  @IsEnum(MaritalStatus)
  @IsOptional()
  maritalStatus?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  stateOfOrigin?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lga?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  town?: string;

  @IsString()
  @IsOptional()
  permanentAddress?: string;

  @IsString()
  @IsOptional()
  religion?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  preferredLanguage?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  addressOfResidence?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  profession?: string;

  @IsString()
  @IsOptional()
  nextOfKinName?: string;

  @IsString()
  @IsOptional()
  nextOfKinPhone?: string;

  @IsString()
  @IsOptional()
  nextOfKinAddress?: string;

  @IsString()
  @IsOptional()
  nextOfKinRelationship?: string;

  @IsString()
  @IsOptional()
  hmo?: string;

  @ApiPropertyOptional({
    description:
      'Preferred: link patient to an HMO record (GET /hmos). Syncs legacy `hmo` text to the HMO name.',
  })
  @IsOptional()
  @IsUUID()
  hmoId?: string;

  @ApiPropertyOptional({
    description: 'Optional: assign patient to a ward (GET /wards).',
  })
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @IsString()
  @IsOptional()
  fingerprintData?: string;

  @IsString()
  @IsOptional()
  cardNo?: string;
}

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  surname?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  otherName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  addressOfResidence?: string;

  @IsString()
  @IsOptional()
  hmo?: string;

  @ApiPropertyOptional({
    description:
      'Link patient to an HMO (GET /hmos). When set, updates legacy `hmo` text to match HMO name; use null to clear.',
  })
  @IsOptional()
  @IsUUID()
  hmoId?: string | null;

  @IsString()
  @IsOptional()
  nextOfKinName?: string;

  @IsString()
  @IsOptional()
  nextOfKinPhone?: string;

  @IsString()
  @IsOptional()
  nextOfKinAddress?: string;

  @IsString()
  @IsOptional()
  nextOfKinRelationship?: string;

  @IsString()
  @IsOptional()
  status?: PatientStatus;

  @ApiPropertyOptional({
    description:
      'Assign patient to a ward (GET /wards). Send null to clear ward on the patient record.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsUUID()
  wardId?: string | null;
}

export class PatientResponseDto {
  id?: string;
  patientId?: string;
  title?: string;
  surname?: string;
  firstName?: string;
  otherName?: string;
  dob?: Date;
  gender: string;
  maritalStatus: string;
  nationality?: string;
  stateOfOrigin?: string;
  lga?: string;
  town?: string;
  email?: string;
  phoneNumber?: string;
  hmo?: string;
  hmoId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: string;
}
