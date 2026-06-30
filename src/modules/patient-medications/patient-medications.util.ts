import {
  MedicationTimeOfDay,
  PatientMedicationDoseStatus,
  PrescriptionStatus,
} from '@prisma/client';
import { HOSPITAL_TIMEZONE } from '../../common/utils/datetime';
import { formatDoctorName } from '../patient-medical-records/patient-medical-records.util';
import { parseFrequency } from '../medication-schedule/rx-schedule.utils';
import {
  ActivePrescriptionSummaryDto,
  MedicationDoseSummaryDto,
  MedicationScheduleEntryDto,
  PrescriptionHistorySummaryDto,
  PrescriptionSupplyStatus,
} from './dto/medication-response.dto';

type DrugFields = {
  brandName?: string | null;
  genericName?: string | null;
  strength?: string | null;
} | null;

type PrescriptionItemRow = {
  id: string;
  dosage: string;
  frequency: string | null;
  instructions: string | null;
  quantityDispensed: number;
  drug: DrugFields;
  doseLogs?: Array<{ id: string }>;
};

type DoseLogRow = {
  id: string;
  prescriptionItemId: string;
  scheduledAt: Date;
  timeOfDay: MedicationTimeOfDay;
  status: PatientMedicationDoseStatus;
  prescriptionItem: {
    dosage: string;
    instructions: string | null;
    drug: DrugFields;
  };
};

type ActivePrescriptionRow = {
  id: string;
  endDate: Date | null;
  refillsAllowed: number;
  items: PrescriptionItemRow[];
};

type HistoryPrescriptionRow = {
  id: string;
  status: PrescriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  doctor: { firstName: string | null; lastName: string | null } | null;
  items: Array<{ dosage: string; frequency: string | null; drug: DrugFields }>;
};

export function getHospitalDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getHospitalTimezoneOffset(): string {
  if (HOSPITAL_TIMEZONE === 'Africa/Lagos') {
    return '+01:00';
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOSPITAL_TIMEZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date());
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
  const match = offset?.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return '+00:00';
  const hours = String(Math.abs(Number(match[1]))).padStart(2, '0');
  const sign = Number(match[1]) >= 0 ? '+' : '-';
  const minutes = String(Number(match[2] ?? '0')).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export function hospitalLocalToUtc(
  dateStr: string,
  hour: number,
  minute = 0,
): Date {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00.000${getHospitalTimezoneOffset()}`);
}

export function getHospitalDayStart(date: Date): Date {
  return hospitalLocalToUtc(getHospitalDateString(date), 0, 0);
}

export function getHospitalDayEnd(date: Date): Date {
  const start = getHospitalDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function getHospitalLocalHour(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOSPITAL_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
}

export function deriveTimeOfDay(scheduledAt: Date): MedicationTimeOfDay {
  const hour = getHospitalLocalHour(scheduledAt);
  if (hour >= 5 && hour <= 11) {
    return MedicationTimeOfDay.MORNING;
  }
  if (hour >= 12 && hour <= 16) {
    return MedicationTimeOfDay.AFTERNOON;
  }
  return MedicationTimeOfDay.EVENING;
}

export function prescriptionItemDrugName(item: { drug: DrugFields }): string {
  if (item.drug?.brandName) return item.drug.brandName;
  if (item.drug?.genericName) return item.drug.genericName;
  return 'Medication';
}

export function buildDisplayName(item: PrescriptionItemRow): string {
  const drugName = prescriptionItemDrugName(item);
  return item.dosage ? `${drugName} ${item.dosage}` : drugName;
}

export function buildFrequencyLabel(frequency: string | null | undefined): string {
  const normalized = (frequency ?? '').trim();
  if (!normalized) return 'As directed';
  return normalized;
}

export function computeSupplyMetrics(
  prescription: ActivePrescriptionRow,
  now: Date,
): {
  daysRemaining: number;
  supplyProgress: number;
  supplyStatus: PrescriptionSupplyStatus;
} {
  const primaryItem = prescription.items[0];
  if (!primaryItem) {
    return {
      daysRemaining: 0,
      supplyProgress: 0,
      supplyStatus: PrescriptionSupplyStatus.EXPIRED,
    };
  }

  const totalDispensed = prescription.items.reduce(
    (sum, item) => sum + item.quantityDispensed,
    0,
  );
  const takenCount = prescription.items.reduce(
    (sum, item) => sum + (item.doseLogs?.length ?? 0),
    0,
  );
  const estimatedConsumed = takenCount;
  const remainingUnits = Math.max(0, totalDispensed - estimatedConsumed);
  const dailyDoseCount = Math.max(
    parseFrequency(primaryItem.frequency).dosesPerDay,
    0.0001,
  );
  const daysRemaining = Math.floor(remainingUnits / dailyDoseCount);
  const supplyProgress =
    totalDispensed > 0
      ? Math.min(1, Math.max(0, estimatedConsumed / totalDispensed))
      : 0;

  let supplyStatus = PrescriptionSupplyStatus.HEALTHY;
  if (
    (prescription.endDate && prescription.endDate < now) ||
    daysRemaining <= 0
  ) {
    supplyStatus = PrescriptionSupplyStatus.EXPIRED;
  } else if (daysRemaining <= 7) {
    supplyStatus = PrescriptionSupplyStatus.LOW;
  }

  return { daysRemaining, supplyProgress, supplyStatus };
}

export function toMedicationDoseSummaryDto(
  dose: DoseLogRow,
  includeInstructions = true,
): MedicationDoseSummaryDto {
  const item = dose.prescriptionItem;
  return {
    id: dose.id,
    prescriptionItemId: dose.prescriptionItemId,
    drugName: prescriptionItemDrugName(item),
    dosage: item.dosage,
    ...(includeInstructions ? { instructions: item.instructions } : {}),
    scheduledAt: dose.scheduledAt,
    status: dose.status,
  };
}

export function toMedicationScheduleEntryDto(
  dose: DoseLogRow,
): MedicationScheduleEntryDto {
  return {
    ...toMedicationDoseSummaryDto(dose, false),
    timeOfDay: dose.timeOfDay,
  };
}

export function toActivePrescriptionSummaryDto(
  prescription: ActivePrescriptionRow,
  now: Date,
): ActivePrescriptionSummaryDto {
  const primaryItem = prescription.items[0];
  const { daysRemaining, supplyProgress, supplyStatus } =
    computeSupplyMetrics(prescription, now);

  return {
    id: prescription.id,
    displayName: primaryItem ? buildDisplayName(primaryItem) : 'Prescription',
    frequencyLabel: buildFrequencyLabel(primaryItem?.frequency),
    daysRemaining,
    refillsRemaining: prescription.refillsAllowed,
    supplyProgress,
    supplyStatus,
  };
}

export function toPrescriptionHistorySummaryDto(
  prescription: HistoryPrescriptionRow,
): PrescriptionHistorySummaryDto {
  const primaryItem = prescription.items[0];
  return {
    id: prescription.id,
    displayName: primaryItem
      ? buildDisplayName(primaryItem as PrescriptionItemRow)
      : 'Prescription',
    frequencyLabel: buildFrequencyLabel(primaryItem?.frequency),
    status: prescription.status,
    startDate: prescription.startDate,
    endDate: prescription.endDate,
    doctorName: formatDoctorName(
      prescription.doctor ?? { firstName: null, lastName: null },
    ),
  };
}

export function getDoseSlotHours(
  dosesPerDay: number,
  isIntervalBased: boolean,
  frequencyIntervalHours: number,
): number[] {
  if (isIntervalBased && frequencyIntervalHours > 0) {
    const slots: number[] = [];
    let hour = 8;
    for (let i = 0; i < Math.ceil(24 / frequencyIntervalHours); i += 1) {
      if (hour >= 24) break;
      slots.push(hour);
      hour += frequencyIntervalHours;
    }
    return slots.length ? slots : [8];
  }

  if (dosesPerDay >= 4) return [8, 12, 16, 20];
  if (dosesPerDay >= 3) return [8, 14, 20];
  if (dosesPerDay >= 2) return [8, 20];
  return [8];
}
