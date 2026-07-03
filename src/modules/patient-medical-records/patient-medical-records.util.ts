import { EncounterStatus, LabAbnormalFlag } from '@prisma/client';
import {
  EncounterDiagnosisDto,
  EncounterPrescriptionDto,
  EncounterPrescriptionItemDto,
  EncounterSoapDto,
  EncounterSummaryDto,
  EncounterVitalsDto,
} from './dto/encounter-response.dto';
import {
  MedicalRecordAllergyDto,
  MedicalRecordLabResultDto,
  MedicalRecordRecentDiagnosisDto,
  LatestVitalsDto,
} from './dto/medical-records-dashboard-response.dto';

type DoctorNameFields = {
  firstName: string | null;
  lastName: string | null;
};

type EncounterListRow = {
  id: string;
  encounterType: EncounterSummaryDto['encounterType'];
  status: EncounterSummaryDto['status'];
  startTime: Date;
  endTime: Date | null;
  chiefComplaint: string | null;
  visitType: string | null;
  primaryIcdDescription: string | null;
  doctor: DoctorNameFields;
  diagnoses: Array<{
    primaryIcdDescription: string | null;
  }>;
};

type HomeVitalsRow = {
  pulseRate: number | null;
  systolic: number | null;
  diastolic: number | null;
  recordedAt: Date;
};

export function hasHomeVitals(vitals: HomeVitalsRow): boolean {
  return (
    vitals.pulseRate != null ||
    vitals.systolic != null ||
    vitals.diastolic != null
  );
}

export function computeBloodPressureStatus(
  systolic: number | null | undefined,
  diastolic: number | null | undefined,
): string | null {
  if (systolic == null || diastolic == null) {
    return null;
  }
  if (systolic < 120 && diastolic < 80) {
    return 'Normal';
  }
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return 'Elevated';
  }
  if (systolic >= 130 || diastolic >= 80) {
    return 'High';
  }
  return null;
}

export function toLatestVitalsDto(
  vitals: HomeVitalsRow | null | undefined,
): LatestVitalsDto | null {
  if (!vitals || !hasHomeVitals(vitals)) {
    return null;
  }
  return {
    pulseRate: vitals.pulseRate,
    systolic: vitals.systolic,
    diastolic: vitals.diastolic,
    recordedAt: vitals.recordedAt,
    bloodPressureStatus: computeBloodPressureStatus(
      vitals.systolic,
      vitals.diastolic,
    ),
  };
}

type VitalsRow = {
  systolic: number | null;
  diastolic: number | null;
  temperature: number | null;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  pulseRate: number | null;
  respRate: number | null;
  spo2: number | null;
  painScore: number | null;
  bloodGlucose: number | null;
  recordedAt: Date;
};

type PrescriptionRow = {
  id: string;
  drug: string | null;
  dosage: string | null;
  notes: string | null;
  startDate: Date | null;
  endDate: Date | null;
  items: Array<{
    dosage: string;
    frequency: string | null;
    duration: number | null;
    instructions: string | null;
    drug: { brandName: string; genericName: string } | null;
    consumable: { name: string } | null;
  }>;
};

type EncounterDetailRow = EncounterListRow & {
  primaryIcdCode: string | null;
  followUpDate: string | null;
  followUpInstructions: string | null;
  referral: string | null;
  soapSubjective: string | null;
  soapObjective: string | null;
  soapAssessment: string | null;
  soapPlan: string | null;
  diagnoses: Array<{
    primaryIcdCode: string | null;
    primaryIcdDescription: string | null;
    secondaryDiagnosesJson: unknown;
  }>;
  patientVitals: VitalsRow[];
  prescriptions: PrescriptionRow[];
};

export function formatDoctorName(doctor: DoctorNameFields): string {
  const parts = [doctor.firstName, doctor.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown doctor';
}

function resolvePrimaryDiagnosis(encounter: EncounterListRow): string | null {
  if (encounter.primaryIcdDescription) {
    return encounter.primaryIcdDescription;
  }
  const fromDiagnoses = encounter.diagnoses.find(
    (d) => d.primaryIcdDescription,
  )?.primaryIcdDescription;
  return fromDiagnoses ?? null;
}

export function toEncounterSummaryDto(
  encounter: EncounterListRow,
): EncounterSummaryDto {
  return {
    id: encounter.id,
    encounterType: encounter.encounterType,
    status: encounter.status,
    startTime: encounter.startTime,
    endTime: encounter.endTime,
    chiefComplaint: encounter.chiefComplaint,
    visitType: encounter.visitType,
    doctorName: formatDoctorName(encounter.doctor),
    primaryDiagnosis: resolvePrimaryDiagnosis(encounter),
  };
}

function toVitalsDto(vitals: VitalsRow | undefined): EncounterVitalsDto | null {
  if (!vitals) return null;
  return {
    systolic: vitals.systolic,
    diastolic: vitals.diastolic,
    temperature: vitals.temperature,
    height: vitals.height,
    weight: vitals.weight,
    bmi: vitals.bmi,
    pulseRate: vitals.pulseRate,
    respRate: vitals.respRate,
    spo2: vitals.spo2,
    painScore: vitals.painScore,
    bloodGlucose: vitals.bloodGlucose,
    recordedAt: vitals.recordedAt,
  };
}

function toDiagnosisDto(
  diagnosis: EncounterDetailRow['diagnoses'][number],
): EncounterDiagnosisDto {
  return {
    primaryIcdCode: diagnosis.primaryIcdCode,
    primaryIcdDescription: diagnosis.primaryIcdDescription,
    secondaryDiagnoses: diagnosis.secondaryDiagnosesJson ?? null,
  };
}

function prescriptionItemDrugName(
  item: PrescriptionRow['items'][number],
): string {
  if (item.drug) {
    return item.drug.brandName || item.drug.genericName;
  }
  if (item.consumable) {
    return item.consumable.name;
  }
  return 'Medication';
}

function toPrescriptionItemDto(
  item: PrescriptionRow['items'][number],
): EncounterPrescriptionItemDto {
  return {
    drugName: prescriptionItemDrugName(item),
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    instructions: item.instructions,
  };
}

function toPrescriptionDto(
  prescription: PrescriptionRow,
): EncounterPrescriptionDto {
  return {
    id: prescription.id,
    drug: prescription.drug,
    dosage: prescription.dosage,
    notes: prescription.notes,
    startDate: prescription.startDate,
    endDate: prescription.endDate,
    items: prescription.items.map(toPrescriptionItemDto),
  };
}

function toSoapDto(encounter: EncounterDetailRow): EncounterSoapDto | null {
  if (encounter.status !== EncounterStatus.COMPLETED) {
    return null;
  }
  const soap = {
    subjective: encounter.soapSubjective,
    objective: encounter.soapObjective,
    assessment: encounter.soapAssessment,
    plan: encounter.soapPlan,
  };
  const hasContent = Object.values(soap).some((value) => Boolean(value));
  return hasContent ? soap : null;
}

function buildDiagnoses(
  encounter: EncounterDetailRow,
): EncounterDiagnosisDto[] {
  if (encounter.diagnoses.length > 0) {
    return encounter.diagnoses.map(toDiagnosisDto);
  }
  if (encounter.primaryIcdCode || encounter.primaryIcdDescription) {
    return [
      {
        primaryIcdCode: encounter.primaryIcdCode,
        primaryIcdDescription: encounter.primaryIcdDescription,
        secondaryDiagnoses: null,
      },
    ];
  }
  return [];
}

export function toEncounterDetailDto(
  encounter: EncounterDetailRow,
): EncounterSummaryDto & {
  vitals?: EncounterVitalsDto | null;
  diagnoses: EncounterDiagnosisDto[];
  prescriptions: EncounterPrescriptionDto[];
  soap?: EncounterSoapDto | null;
  followUpDate?: string | null;
  followUpInstructions?: string | null;
  referral?: string | null;
} {
  const latestVitals = encounter.patientVitals[0];
  return {
    ...toEncounterSummaryDto(encounter),
    vitals: toVitalsDto(latestVitals),
    diagnoses: buildDiagnoses(encounter),
    prescriptions: encounter.prescriptions.map(toPrescriptionDto),
    soap: toSoapDto(encounter),
    followUpDate: encounter.followUpDate,
    followUpInstructions: encounter.followUpInstructions,
    referral: encounter.referral,
  };
}

type DashboardDiagnosisRow = {
  id: string;
  primaryIcdDescription: string | null;
  createdAt: Date;
  encounter: {
    status: EncounterStatus;
    doctor: {
      firstName: string;
      lastName: string;
      department: { name: string } | null;
    };
  };
};

type DashboardLabResultRow = {
  value: string | null;
  abnormalFlag: LabAbnormalFlag | null;
  createdAt: Date;
  field: {
    label: string;
    referenceRange: string | null;
  };
};

export function toMedicalRecordAllergyDto(allergy: {
  allergen: string;
  severity: string | null;
}): MedicalRecordAllergyDto {
  return {
    name: allergy.allergen,
    severity: allergy.severity,
  };
}

export function toMedicalRecordRecentDiagnosisDto(
  diagnosis: DashboardDiagnosisRow,
): MedicalRecordRecentDiagnosisDto {
  return {
    id: diagnosis.id,
    title: diagnosis.primaryIcdDescription ?? 'Diagnosis',
    doctorName: formatDoctorName(diagnosis.encounter.doctor),
    specialty: diagnosis.encounter.doctor.department?.name ?? null,
    status: diagnosis.encounter.status,
    diagnosedAt: diagnosis.createdAt,
  };
}

export function toMedicalRecordLabResultDto(
  result: DashboardLabResultRow,
): MedicalRecordLabResultDto {
  return {
    testName: result.field.label,
    result: result.value,
    referenceRange: result.field.referenceRange,
    status: result.abnormalFlag ?? 'UNKNOWN',
  };
}
