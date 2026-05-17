import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsIn,
  ValidateIf,
} from 'class-validator';

/** Allowed discharge outcomes when `dischargeDate` is set. */
export const DISCHARGE_OUTCOMES = [
  'Duly Discharged',
  'Discharged against Medical Advice',
  'Referred out',
  'Death',
] as const;

export class CreateAdmissionDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @IsUUID()
  @IsNotEmpty()
  wardId: string;

  @IsUUID()
  @IsNotEmpty()
  bedId: string;

  @IsDateString()
  @IsOptional()
  admissionDate: string;

  @IsDateString()
  @IsOptional()
  dischargeDate?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsUUID()
  @IsOptional()
  createdById: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;
}

export class UpdateAdmissionDto {
  @IsDateString()
  @IsOptional()
  dischargeDate?: string;

  @ValidateIf(
    (o) => o.dischargeDate != null && String(o.dischargeDate).trim() !== '',
  )
  @IsNotEmpty({ message: 'outcome is required when discharging' })
  @IsIn(DISCHARGE_OUTCOMES, {
    message: `outcome must be one of: ${DISCHARGE_OUTCOMES.join(', ')}`,
  })
  outcome?: string;

  @ValidateIf(
    (o) => o.dischargeDate != null && String(o.dischargeDate).trim() !== '',
  )
  @IsOptional()
  @IsString()
  dischargeSummary?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  wardId?: string;

  @IsString()
  @IsOptional()
  bedId?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;
}
