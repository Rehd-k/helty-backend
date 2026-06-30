import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EncounterStatus, EncounterType } from '@prisma/client';

export class EncounterSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EncounterType })
  encounterType!: EncounterType;

  @ApiProperty({ enum: EncounterStatus })
  status!: EncounterStatus;

  @ApiProperty()
  startTime!: Date;

  @ApiPropertyOptional()
  endTime?: Date | null;

  @ApiPropertyOptional()
  chiefComplaint?: string | null;

  @ApiPropertyOptional()
  visitType?: string | null;

  @ApiProperty()
  doctorName!: string;

  @ApiPropertyOptional()
  primaryDiagnosis?: string | null;
}

export class EncounterListResponseDto {
  @ApiProperty({ type: [EncounterSummaryDto] })
  data!: EncounterSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class EncounterVitalsDto {
  @ApiPropertyOptional()
  systolic?: number | null;

  @ApiPropertyOptional()
  diastolic?: number | null;

  @ApiPropertyOptional()
  temperature?: number | null;

  @ApiPropertyOptional()
  height?: number | null;

  @ApiPropertyOptional()
  weight?: number | null;

  @ApiPropertyOptional()
  bmi?: number | null;

  @ApiPropertyOptional()
  pulseRate?: number | null;

  @ApiPropertyOptional()
  respRate?: number | null;

  @ApiPropertyOptional()
  spo2?: number | null;

  @ApiPropertyOptional()
  painScore?: number | null;

  @ApiPropertyOptional()
  bloodGlucose?: number | null;

  @ApiPropertyOptional()
  recordedAt?: Date | null;
}

export class EncounterDiagnosisDto {
  @ApiPropertyOptional()
  primaryIcdCode?: string | null;

  @ApiPropertyOptional()
  primaryIcdDescription?: string | null;

  @ApiPropertyOptional()
  secondaryDiagnoses?: unknown;
}

export class EncounterPrescriptionItemDto {
  @ApiProperty()
  drugName!: string;

  @ApiProperty()
  dosage!: string;

  @ApiPropertyOptional()
  frequency?: string | null;

  @ApiPropertyOptional()
  duration?: number | null;

  @ApiPropertyOptional()
  instructions?: string | null;
}

export class EncounterPrescriptionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  drug?: string | null;

  @ApiPropertyOptional()
  dosage?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  startDate?: Date | null;

  @ApiPropertyOptional()
  endDate?: Date | null;

  @ApiProperty({ type: [EncounterPrescriptionItemDto] })
  items!: EncounterPrescriptionItemDto[];
}

export class EncounterSoapDto {
  @ApiPropertyOptional()
  subjective?: string | null;

  @ApiPropertyOptional()
  objective?: string | null;

  @ApiPropertyOptional()
  assessment?: string | null;

  @ApiPropertyOptional()
  plan?: string | null;
}

export class EncounterDetailDto extends EncounterSummaryDto {
  @ApiPropertyOptional({ type: EncounterVitalsDto })
  vitals?: EncounterVitalsDto | null;

  @ApiProperty({ type: [EncounterDiagnosisDto] })
  diagnoses!: EncounterDiagnosisDto[];

  @ApiProperty({ type: [EncounterPrescriptionDto] })
  prescriptions!: EncounterPrescriptionDto[];

  @ApiPropertyOptional({ type: EncounterSoapDto })
  soap?: EncounterSoapDto | null;

  @ApiPropertyOptional()
  followUpDate?: string | null;

  @ApiPropertyOptional()
  followUpInstructions?: string | null;

  @ApiPropertyOptional()
  referral?: string | null;
}
