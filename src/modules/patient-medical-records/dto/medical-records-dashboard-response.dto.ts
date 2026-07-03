import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicalRecordAllergyDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  severity?: string | null;
}

export class MedicalRecordRecentDiagnosisDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  doctorName!: string;

  @ApiPropertyOptional()
  specialty?: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  diagnosedAt!: Date;
}

export class MedicalRecordImmunizationDto {
  @ApiProperty()
  vaccineName!: string;

  @ApiPropertyOptional()
  detail?: string | null;

  @ApiProperty()
  date!: Date;
}

export class MedicalRecordLabResultDto {
  @ApiProperty()
  testName!: string;

  @ApiPropertyOptional()
  result?: string | null;

  @ApiPropertyOptional()
  referenceRange?: string | null;

  @ApiProperty()
  status!: string;
}

export class LatestVitalsDto {
  @ApiPropertyOptional()
  pulseRate?: number | null;

  @ApiPropertyOptional()
  systolic?: number | null;

  @ApiPropertyOptional()
  diastolic?: number | null;

  @ApiPropertyOptional()
  recordedAt?: Date | null;

  @ApiPropertyOptional()
  bloodPressureStatus?: string | null;
}

export class MedicalRecordsDashboardResponseDto {
  @ApiPropertyOptional()
  bloodType?: string | null;

  @ApiPropertyOptional()
  heightCm?: number | null;

  @ApiPropertyOptional()
  weightKg?: number | null;

  @ApiPropertyOptional({ type: LatestVitalsDto, nullable: true })
  latestVitals!: LatestVitalsDto | null;

  @ApiProperty({ type: [MedicalRecordAllergyDto] })
  allergies!: MedicalRecordAllergyDto[];

  @ApiProperty({ type: [MedicalRecordRecentDiagnosisDto] })
  recentDiagnoses!: MedicalRecordRecentDiagnosisDto[];

  @ApiProperty({ type: [MedicalRecordImmunizationDto] })
  immunizations!: MedicalRecordImmunizationDto[];

  @ApiProperty({ type: [MedicalRecordLabResultDto] })
  recentLabResults!: MedicalRecordLabResultDto[];
}
