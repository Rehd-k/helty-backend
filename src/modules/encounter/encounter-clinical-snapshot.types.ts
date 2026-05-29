import { MedicalSpecialty } from '@prisma/client';

export const ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS = [
  'chiefComplaint',
  'hpi',
  'pmh',
  'surgicalHistory',
  'drugHistory',
  'allergyHistory',
  'familyHistory',
  'socialHistory',
  'examinationNotes',
  'soapSubjective',
  'soapObjective',
  'soapAssessment',
  'soapPlan',
  'triageNotes',
  'proceduresJson',
] as const;

export type EncounterClinicalField =
  (typeof ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS)[number];

export type EncounterClinicalSnapshotFields = Record<
  EncounterClinicalField,
  string | null
>;

export type ClinicalDiagnosisSnapshot = {
  id: string;
  primaryIcdCode: string | null;
  primaryIcdDescription: string | null;
  secondaryDiagnosesJson: unknown;
};

export type SpecialtyModuleSnapshot = {
  specialty: MedicalSpecialty;
  enabledSectionKeys: unknown;
};

export type ClinicalSectionSnapshot = {
  specialty: MedicalSpecialty;
  sectionKey: string;
  schemaVersion: number;
  data: unknown;
};

export type ClinicalSnapshot = {
  encounter: EncounterClinicalSnapshotFields;
  diagnoses: ClinicalDiagnosisSnapshot[];
  specialtyModules: SpecialtyModuleSnapshot[];
  clinicalSections: ClinicalSectionSnapshot[];
};

export type EncounterEditMeta = {
  hasEdits: boolean;
  editCount: number;
  lastEditedAt: string | null;
  canEdit: boolean;
  requiresVersionedEdits: boolean;
};
