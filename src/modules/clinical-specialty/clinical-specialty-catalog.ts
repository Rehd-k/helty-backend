import { MedicalSpecialty } from '@prisma/client';

export const CATALOG_VERSION = 1;

export type SectionIntegrationKind = 'embedded' | 'deep_link';

export interface ClinicalSectionDefinition {
  /** Stable id, e.g. cardiology.ecg — must match Prisma sectionKey storage */
  key: string;
  label: string;
  sortOrder: number;
  description?: string;
  /** embedded = JSON in EncounterClinicalSection; deep_link = canonical data elsewhere */
  integration?: SectionIntegrationKind;
  /** Hint for Flutter (e.g. obstetrics flow); not enforced server-side */
  deepLinkRoute?: string;
  /** Example payload shape for code generation / docs */
  exampleData?: Record<string, unknown>;
}

export interface SpecialtyCatalogEntry {
  code: MedicalSpecialty;
  displayName: string;
  description: string;
  sections: ClinicalSectionDefinition[];
}

/** Static v1 registry: specialties and section keys for dynamic forms + validation */
export const CLINICAL_SPECIALTY_CATALOG: SpecialtyCatalogEntry[] = [
  {
    code: MedicalSpecialty.CARDIOLOGY,
    displayName: 'Cardiology',
    description: 'Heart and blood vessels',
    sections: [
      {
        key: 'cardiology.ecg',
        label: 'ECG',
        sortOrder: 10,
        exampleData: {
          rhythm: 'sinus',
          rateBpm: 72,
          interpretation: '',
          attachmentUrls: [] as string[],
        },
      },
      {
        key: 'cardiology.echocardiogram',
        label: 'Echocardiogram summary',
        sortOrder: 20,
        exampleData: {
          lvefPercent: null as number | null,
          valves: '',
          summary: '',
          attachmentUrls: [] as string[],
        },
      },
      {
        key: 'cardiology.risk_scores',
        label: 'Cardiac risk scoring',
        sortOrder: 30,
        exampleData: { ascvdRiskPercent: null, scoreSystem: 'ASCVD', notes: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.NEUROLOGY,
    displayName: 'Neurology',
    description: 'Brain, nerves, spinal cord',
    sections: [
      {
        key: 'neurology.exam',
        label: 'Neurological examination',
        sortOrder: 10,
        exampleData: { mentalStatus: '', cranialNerves: '', motor: '', sensory: '' },
      },
      {
        key: 'neurology.stroke_assessment',
        label: 'Stroke / acute neuro assessment',
        sortOrder: 20,
        exampleData: { nihss: null, lastKnownWell: '', ctSummary: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.DERMATOLOGY,
    displayName: 'Dermatology',
    description: 'Skin, hair, nails',
    sections: [
      {
        key: 'dermatology.lesion_gallery',
        label: 'Lesion images & mapping',
        sortOrder: 10,
        exampleData: {
          lesions: [] as Array<{
            id: string;
            imageUrls: string[];
            site: string;
            description: string;
          }>,
        },
      },
      {
        key: 'dermatology.skin_assessment',
        label: 'Skin assessment',
        sortOrder: 20,
        exampleData: { morphology: '', distribution: '', dermoscopyNotes: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PEDIATRICS,
    displayName: 'Pediatrics',
    description: "Children's health",
    sections: [
      {
        key: 'pediatrics.growth',
        label: 'Growth & development',
        sortOrder: 10,
        exampleData: { weightKg: null, heightCm: null, milestones: '' },
      },
      {
        key: 'pediatrics.vitals_pediatric',
        label: 'Age-adjusted vitals',
        sortOrder: 20,
        exampleData: { ageMonths: null, hr: null, rr: null, notes: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.OBSTETRICS_GYNECOLOGY,
    displayName: 'Obstetrics & Gynecology',
    description: "Pregnancy and women's reproductive health",
    sections: [
      {
        key: 'obgyn.antenatal_visit',
        label: 'Antenatal visit',
        sortOrder: 10,
        integration: 'deep_link',
        deepLinkRoute: '/obstetrics/antenatal-visits',
        exampleData: { pregnancyId: '', notes: 'Use POST /obstetrics/... with encounterId' },
      },
      {
        key: 'obgyn.gynae_procedure',
        label: 'Gynaecology procedure',
        sortOrder: 20,
        integration: 'deep_link',
        deepLinkRoute: '/obstetrics/gynae-procedures',
        exampleData: { procedureType: '', surgeonId: '' },
      },
      {
        key: 'obgyn.pregnancy_summary',
        label: 'Pregnancy summary (embedded)',
        sortOrder: 30,
        exampleData: { gravida: null, para: null, edd: '', quickNotes: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.ORTHOPEDICS,
    displayName: 'Orthopedics',
    description: 'Bones, joints, muscles',
    sections: [
      {
        key: 'orthopedics.fracture',
        label: 'Fracture tracking',
        sortOrder: 10,
        exampleData: {
          site: '',
          classification: '',
          openGrade: null as number | null,
          imagingUrls: [] as string[],
        },
      },
      {
        key: 'orthopedics.mobility',
        label: 'Mobility & functional assessment',
        sortOrder: 20,
        exampleData: { joint: '', rom: '', weightBearing: '', assistiveDevice: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PSYCHIATRY,
    displayName: 'Psychiatry',
    description: 'Mental health',
    sections: [
      {
        key: 'psychiatry.mse',
        label: 'Mental status examination',
        sortOrder: 10,
        exampleData: { appearance: '', mood: '', thought: '', riskAssessment: '' },
      },
      {
        key: 'psychiatry.safety',
        label: 'Safety / risk plan',
        sortOrder: 20,
        exampleData: { suicidalIdeation: false, plan: '', protectiveFactors: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.OPHTHALMOLOGY,
    displayName: 'Ophthalmology',
    description: 'Eyes and vision',
    sections: [
      {
        key: 'ophthalmology.visual_acuity',
        label: 'Visual acuity',
        sortOrder: 10,
        exampleData: { od: '', os: '', correction: '' },
      },
      {
        key: 'ophthalmology.fundus',
        label: 'Fundus / anterior segment',
        sortOrder: 20,
        exampleData: { od: '', os: '', iopOd: null, iopOs: null },
      },
    ],
  },
  {
    code: MedicalSpecialty.OTOLARYNGOLOGY,
    displayName: 'Otolaryngology (ENT)',
    description: 'Ear, nose, throat',
    sections: [
      {
        key: 'ent.exam',
        label: 'ENT examination',
        sortOrder: 10,
        exampleData: { ears: '', nose: '', throat: '', hearingNotes: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.UROLOGY,
    displayName: 'Urology',
    description: 'Urinary tract and male reproductive system',
    sections: [
      {
        key: 'urology.luts',
        label: 'LUTS / voiding',
        sortOrder: 10,
        exampleData: { ipssScore: null, stream: '', hematuria: false },
      },
    ],
  },
  {
    code: MedicalSpecialty.NEPHROLOGY,
    displayName: 'Nephrology',
    description: 'Kidneys',
    sections: [
      {
        key: 'nephrology.ckd',
        label: 'CKD / electrolyte focus',
        sortOrder: 10,
        exampleData: { egfr: null, proteinuria: '', dialysisStatus: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.ENDOCRINOLOGY,
    displayName: 'Endocrinology',
    description: 'Hormones and glands',
    sections: [
      {
        key: 'endocrinology.diabetes',
        label: 'Diabetes / glucose',
        sortOrder: 10,
        exampleData: { hba1c: null, insulinRegimen: '', hypoglycemiaRisk: '' },
      },
      {
        key: 'endocrinology.thyroid',
        label: 'Thyroid',
        sortOrder: 20,
        exampleData: { exam: '', nodules: '', labsSummary: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.GASTROENTEROLOGY,
    displayName: 'Gastroenterology',
    description: 'Digestive system',
    sections: [
      {
        key: 'gi.history',
        label: 'GI history & alarm features',
        sortOrder: 10,
        exampleData: { symptoms: '', melena: false, weightLoss: false },
      },
      {
        key: 'gi.exam',
        label: 'Abdominal exam',
        sortOrder: 20,
        exampleData: { bowelSounds: '', tenderness: '', organomegaly: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PULMONOLOGY,
    displayName: 'Pulmonology',
    description: 'Lungs and breathing',
    sections: [
      {
        key: 'pulmonology.spirometry_summary',
        label: 'Spirometry / PFT summary',
        sortOrder: 10,
        exampleData: { fev1: null, fvc: null, interpretation: '' },
      },
      {
        key: 'pulmonology.resp_exam',
        label: 'Respiratory examination',
        sortOrder: 20,
        exampleData: { auscultation: '', spo2: null, workOfBreathing: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.HEMATOLOGY,
    displayName: 'Hematology',
    description: 'Blood disorders',
    sections: [
      {
        key: 'hematology.cbc_focus',
        label: 'CBC / coagulation focus',
        sortOrder: 10,
        exampleData: { hb: null, platelets: null, transfusionHistory: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.ONCOLOGY,
    displayName: 'Oncology',
    description: 'Cancer treatment',
    sections: [
      {
        key: 'oncology.treatment_status',
        label: 'Treatment cycle / toxicity',
        sortOrder: 10,
        exampleData: { regimen: '', cycleDay: null, ecog: null, toxicities: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.RADIOLOGY,
    displayName: 'Radiology',
    description: 'Medical imaging (clinical correlation)',
    sections: [
      {
        key: 'radiology.clinical_correlation',
        label: 'Imaging correlation & follow-up',
        sortOrder: 10,
        exampleData: {
          linkedOrderIds: [] as string[],
          impressionSummary: '',
          recommendations: '',
        },
      },
    ],
  },
  {
    code: MedicalSpecialty.ANESTHESIOLOGY,
    displayName: 'Anesthesiology',
    description: 'Anesthesia and pain control',
    sections: [
      {
        key: 'anesthesia.preop',
        label: 'Pre-anesthetic assessment',
        sortOrder: 10,
        exampleData: { asaClass: null, airway: '', meds: '' },
      },
      {
        key: 'anesthesia.acute_pain',
        label: 'Acute pain plan',
        sortOrder: 20,
        exampleData: { plan: '', regionalConsidered: false },
      },
    ],
  },
  {
    code: MedicalSpecialty.EMERGENCY_MEDICINE,
    displayName: 'Emergency Medicine',
    description: 'Emergencies and trauma',
    sections: [
      {
        key: 'em.triage',
        label: 'ED triage & primary survey',
        sortOrder: 10,
        exampleData: { esiLevel: null, abcs: '', interventions: '' },
      },
      {
        key: 'em.disposition',
        label: 'Disposition',
        sortOrder: 20,
        exampleData: { disposition: '', followUp: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.FAMILY_MEDICINE,
    displayName: 'Family Medicine',
    description: 'General healthcare for families',
    sections: [
      {
        key: 'fm.preventive',
        label: 'Preventive & screening',
        sortOrder: 10,
        exampleData: { screeningsDue: '', immunizations: '', lifestyle: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.INTERNAL_MEDICINE,
    displayName: 'Internal Medicine',
    description: 'Adult medicine',
    sections: [
      {
        key: 'im.problem_list',
        label: 'Problem-focused review',
        sortOrder: 10,
        exampleData: { activeProblems: '', medsReconciliation: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.GENERAL_SURGERY,
    displayName: 'General Surgery',
    description: 'Surgical treatment of many conditions',
    sections: [
      {
        key: 'surgery.preop_note',
        label: 'Pre-operative assessment',
        sortOrder: 10,
        exampleData: { diagnosis: '', plannedProcedure: '', consent: false },
      },
    ],
  },
  {
    code: MedicalSpecialty.NEUROSURGERY,
    displayName: 'Neurosurgery',
    description: 'Brain and spine surgery',
    sections: [
      {
        key: 'neurosurg.intracranial_pressure',
        label: 'Neurosurgical focus',
        sortOrder: 10,
        exampleData: { gcs: null, pupils: '', imagingSummary: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PLASTIC_SURGERY,
    displayName: 'Plastic Surgery',
    description: 'Reconstructive and cosmetic surgery',
    sections: [
      {
        key: 'plastics.reconstructive',
        label: 'Reconstructive / cosmetic note',
        sortOrder: 10,
        exampleData: { defect: '', plan: '', markings: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PATHOLOGY,
    displayName: 'Pathology',
    description: 'Diagnosing disease through lab analysis (clinical interface)',
    sections: [
      {
        key: 'pathology.correlation',
        label: 'Lab-pathology correlation',
        sortOrder: 10,
        exampleData: { specimenIds: [] as string[], clinicalQuestion: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.INFECTIOUS_DISEASE,
    displayName: 'Infectious Disease',
    description: 'Infections and tropical diseases',
    sections: [
      {
        key: 'id.antimicrobial',
        label: 'Antimicrobial stewardship note',
        sortOrder: 10,
        exampleData: { syndrome: '', cultures: '', abxPlan: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.RHEUMATOLOGY,
    displayName: 'Rheumatology',
    description: 'Autoimmune and joint diseases',
    sections: [
      {
        key: 'rheum.joint_exam',
        label: 'Joint examination & disease activity',
        sortOrder: 10,
        exampleData: { tenderJoints: '', das28: null, extraArticular: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.CRITICAL_CARE_MEDICINE,
    displayName: 'Critical Care Medicine',
    description: 'ICU and life-threatening illness',
    sections: [
      {
        key: 'icu.daily',
        label: 'ICU daily assessment',
        sortOrder: 10,
        exampleData: { ventSettings: '', vasopressors: '', lines: '', goals: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.PHYSICAL_MEDICINE_REHABILITATION,
    displayName: 'Physical Medicine & Rehabilitation',
    description: 'Rehabilitation and recovery',
    sections: [
      {
        key: 'pmr.functional',
        label: 'Functional / mobility goals',
        sortOrder: 10,
        exampleData: { barthel: null, therapyPlan: '', barriers: '' },
      },
    ],
  },
  {
    code: MedicalSpecialty.ALLERGY_IMMUNOLOGY,
    displayName: 'Allergy & Immunology',
    description: 'Allergies and immune system disorders',
    sections: [
      {
        key: 'allergy.history',
        label: 'Allergy history & testing plan',
        sortOrder: 10,
        exampleData: { triggers: [], skinTesting: '', immunotherapy: '' },
      },
    ],
  },
];

const sectionKeysBySpecialty = new Map<MedicalSpecialty, Set<string>>();
for (const spec of CLINICAL_SPECIALTY_CATALOG) {
  sectionKeysBySpecialty.set(
    spec.code,
    new Set(spec.sections.map((s) => s.key)),
  );
}

export function getCatalogEntry(
  specialty: MedicalSpecialty,
): SpecialtyCatalogEntry | undefined {
  return CLINICAL_SPECIALTY_CATALOG.find((e) => e.code === specialty);
}

export function isSectionKeyAllowed(
  specialty: MedicalSpecialty,
  sectionKey: string,
): boolean {
  return sectionKeysBySpecialty.get(specialty)?.has(sectionKey) ?? false;
}

export const MAX_SECTION_JSON_BYTES = 512_000;
