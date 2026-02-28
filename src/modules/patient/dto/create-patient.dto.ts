import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
  title: string;

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
  dob: string;

  @IsEnum(Gender)
  gender: string;

  @IsEnum(MaritalStatus)
  maritalStatus: string;

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

  @IsString()
  @IsOptional()
  fingerprintData?: string;

  @IsString()
  @IsOptional()
  cardNo?: string;

  // @IsString()
  // @MinLength(2)
  // @MaxLength(50)
  // createdBy: string;

  // @IsString()
  // @MinLength(2)
  // @MaxLength(50)
  // updateBy: string;
}

export class UpdatePatientDto {
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
}

export class PatientResponseDto {
  id: string;
  patientId: string;
  title: string;
  surname: string;
  firstName: string;
  otherName?: string;
  dob: Date;
  gender: string;
  maritalStatus: string;
  nationality?: string;
  stateOfOrigin?: string;
  lga?: string;
  town?: string;
  email?: string;
  phoneNumber?: string;
  hmo?: string;
  createdAt: Date;
  updatedAt: Date;
}
