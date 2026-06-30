import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MedicationTimeOfDay,
  PatientMedicationDoseStatus,
  PrescriptionStatus,
} from '@prisma/client';

export { MedicationTimeOfDay, PatientMedicationDoseStatus as MedicationDoseStatus };

export enum PrescriptionSupplyStatus {
  HEALTHY = 'HEALTHY',
  LOW = 'LOW',
  EXPIRED = 'EXPIRED',
}

export class MedicationDoseSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  prescriptionItemId!: string;

  @ApiProperty()
  drugName!: string;

  @ApiProperty()
  dosage!: string;

  @ApiPropertyOptional({ nullable: true })
  instructions?: string | null;

  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty({ enum: PatientMedicationDoseStatus })
  status!: PatientMedicationDoseStatus;
}

export class MedicationScheduleEntryDto extends MedicationDoseSummaryDto {
  @ApiProperty({ enum: MedicationTimeOfDay })
  timeOfDay!: MedicationTimeOfDay;
}

export class ActivePrescriptionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  frequencyLabel!: string;

  @ApiProperty()
  daysRemaining!: number;

  @ApiProperty()
  refillsRemaining!: number;

  @ApiProperty()
  supplyProgress!: number;

  @ApiProperty({ enum: PrescriptionSupplyStatus })
  supplyStatus!: PrescriptionSupplyStatus;
}

export class MedicationDashboardResponseDto {
  @ApiProperty({ type: [MedicationDoseSummaryDto] })
  nextDoses!: MedicationDoseSummaryDto[];

  @ApiProperty({ type: [MedicationScheduleEntryDto] })
  todaySchedule!: MedicationScheduleEntryDto[];

  @ApiProperty({ type: [ActivePrescriptionSummaryDto] })
  activePrescriptions!: ActivePrescriptionSummaryDto[];
}

export class MarkDoseTakenResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PatientMedicationDoseStatus })
  status!: PatientMedicationDoseStatus;

  @ApiProperty()
  takenAt!: Date;
}

export class PrescriptionHistorySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  frequencyLabel!: string;

  @ApiProperty({ enum: PrescriptionStatus })
  status!: PrescriptionStatus;

  @ApiPropertyOptional({ nullable: true })
  startDate!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endDate!: Date | null;

  @ApiProperty()
  doctorName!: string;
}

export class PrescriptionHistoryListResponseDto {
  @ApiProperty({ type: [PrescriptionHistorySummaryDto] })
  data!: PrescriptionHistorySummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class RefillRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  prescriptionId!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty()
  createdAt!: Date;
}
