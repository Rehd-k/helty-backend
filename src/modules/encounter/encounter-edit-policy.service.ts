import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStatus, EncounterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ClinicalSnapshot,
  ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS,
  EncounterClinicalField,
  EncounterEditMeta,
} from './encounter-clinical-snapshot.types';
import { isSharedInpatientEncounter } from './encounter-inpatient-edit.util';

type EncounterAccess = {
  id: string;
  status: EncounterStatus;
  doctorId: string;
  admissionId: string | null;
  admission: { status: AdmissionStatus } | null;
};

@Injectable()
export class EncounterEditPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async loadEncounterAccess(encounterId: string): Promise<EncounterAccess> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: {
        id: true,
        status: true,
        doctorId: true,
        admissionId: true,
        admission: { select: { status: true } },
      },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${encounterId}" not found.`);
    }
    return encounter;
  }

  private async isEligibleCoveringPhysician(staffId: string): Promise<boolean> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { accountType: true, staffRole: true },
    });
    if (!staff) return false;
    if (staff.accountType === 'SUPER_ADMIN') return true;
    return (
      staff.accountType === 'PHYSICIAN' && staff.staffRole !== 'MEDICAL_STUDENT'
    );
  }

  private async canStaffEditEncounter(
    encounter: EncounterAccess,
    staffId: string,
  ): Promise<{ canEdit: boolean; canEditAsCoveringPhysician: boolean }> {
    if (encounter.status === EncounterStatus.CANCELLED) {
      return { canEdit: false, canEditAsCoveringPhysician: false };
    }
    if (encounter.doctorId === staffId) {
      return { canEdit: true, canEditAsCoveringPhysician: false };
    }
    if (
      isSharedInpatientEncounter(encounter) &&
      (await this.isEligibleCoveringPhysician(staffId))
    ) {
      return { canEdit: true, canEditAsCoveringPhysician: true };
    }
    return { canEdit: false, canEditAsCoveringPhysician: false };
  }

  async assertCanEdit(encounterId: string, staffId: string): Promise<EncounterAccess> {
    const encounter = await this.loadEncounterAccess(encounterId);
    if (encounter.status === EncounterStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot edit a cancelled encounter.',
      );
    }
    const { canEdit } = await this.canStaffEditEncounter(encounter, staffId);
    if (!canEdit) {
      if (isSharedInpatientEncounter(encounter)) {
        throw new ForbiddenException(
          'Only a physician may edit this inpatient encounter while the admission is active.',
        );
      }
      throw new ForbiddenException(
        'Only the treating doctor for this encounter may edit it.',
      );
    }
    return encounter;
  }

  async buildClinicalSnapshot(encounterId: string): Promise<ClinicalSnapshot> {
    const [encounter, diagnoses, specialtyModules, clinicalSections] =
      await Promise.all([
        this.prisma.encounter.findUnique({
          where: { id: encounterId },
          select: {
            chiefComplaint: true,
            hpi: true,
            pmh: true,
            surgicalHistory: true,
            drugHistory: true,
            allergyHistory: true,
            familyHistory: true,
            socialHistory: true,
            examinationNotes: true,
            soapSubjective: true,
            soapObjective: true,
            soapAssessment: true,
            soapPlan: true,
            triageNotes: true,
            proceduresJson: true,
          },
        }),
        this.prisma.encounterDiagnosis.findMany({
          where: { encounterId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            primaryIcdCode: true,
            primaryIcdDescription: true,
            secondaryDiagnosesJson: true,
          },
        }),
        this.prisma.encounterSpecialtyModule.findMany({
          where: { encounterId },
          orderBy: { specialty: 'asc' },
          select: { specialty: true, enabledSectionKeys: true },
        }),
        this.prisma.encounterClinicalSection.findMany({
          where: { encounterId },
          orderBy: [{ specialty: 'asc' }, { sectionKey: 'asc' }],
          select: {
            specialty: true,
            sectionKey: true,
            schemaVersion: true,
            data: true,
          },
        }),
      ]);

    if (!encounter) {
      throw new NotFoundException(`Encounter "${encounterId}" not found.`);
    }

    const encounterFields = {} as ClinicalSnapshot['encounter'];
    for (const key of ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS) {
      encounterFields[key] = encounter[key];
    }

    return {
      encounter: encounterFields,
      diagnoses,
      specialtyModules,
      clinicalSections,
    };
  }

  computeChangedKeys(before: ClinicalSnapshot, after: ClinicalSnapshot): string[] {
    const keys = new Set<string>();

    for (const field of ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS) {
      if (before.encounter[field] !== after.encounter[field]) {
        keys.add(field);
      }
    }

    const beforeDx = new Map(before.diagnoses.map((d) => [d.id, d]));
    const afterDx = new Map(after.diagnoses.map((d) => [d.id, d]));

    for (const [id, row] of beforeDx) {
      const next = afterDx.get(id);
      if (!next) {
        keys.add(`diagnoses.${id}`);
        continue;
      }
      if (
        row.primaryIcdCode !== next.primaryIcdCode ||
        row.primaryIcdDescription !== next.primaryIcdDescription ||
        JSON.stringify(row.secondaryDiagnosesJson) !==
          JSON.stringify(next.secondaryDiagnosesJson)
      ) {
        keys.add(`diagnoses.${id}`);
      }
    }
    for (const id of afterDx.keys()) {
      if (!beforeDx.has(id)) keys.add(`diagnoses.${id}`);
    }

    const moduleKey = (s: ClinicalSnapshot['specialtyModules'][0]) =>
      s.specialty;
    const beforeMod = new Map(
      before.specialtyModules.map((m) => [moduleKey(m), m]),
    );
    const afterMod = new Map(
      after.specialtyModules.map((m) => [moduleKey(m), m]),
    );
    for (const [spec, row] of beforeMod) {
      const next = afterMod.get(spec);
      if (
        !next ||
        JSON.stringify(row.enabledSectionKeys) !==
          JSON.stringify(next.enabledSectionKeys)
      ) {
        keys.add(`specialtyModules.${spec}`);
      }
    }
    for (const spec of afterMod.keys()) {
      if (!beforeMod.has(spec)) keys.add(`specialtyModules.${spec}`);
    }

    const sectionKey = (s: ClinicalSnapshot['clinicalSections'][0]) =>
      `${s.specialty}.${s.sectionKey}`;
    const beforeSec = new Map(
      before.clinicalSections.map((s) => [sectionKey(s), s]),
    );
    const afterSec = new Map(
      after.clinicalSections.map((s) => [sectionKey(s), s]),
    );
    for (const [key, row] of beforeSec) {
      const next = afterSec.get(key);
      if (
        !next ||
        row.schemaVersion !== next.schemaVersion ||
        JSON.stringify(row.data) !== JSON.stringify(next.data)
      ) {
        keys.add(`clinicalSections.${key}`);
      }
    }
    for (const key of afterSec.keys()) {
      if (!beforeSec.has(key)) keys.add(`clinicalSections.${key}`);
    }

    return [...keys];
  }

  /** Keys changed on the main encounter row only (for PATCH body diff). */
  computeEncounterFieldChanges(
    before: ClinicalSnapshot,
    patch: Partial<Record<EncounterClinicalField, string | undefined>>,
  ): string[] {
    const keys: string[] = [];
    for (const field of ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS) {
      if (patch[field] === undefined) continue;
      if (before.encounter[field] !== (patch[field] ?? null)) {
        keys.push(field);
      }
    }
    return keys;
  }

  async recordEditIfCompleted(
    encounter: EncounterAccess,
    staffId: string,
    snapshot: ClinicalSnapshot,
    changedKeys: string[],
    reason?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (encounter.status !== EncounterStatus.COMPLETED) return;
    if (changedKeys.length === 0) return;

    const client = tx ?? this.prisma;
    await client.encounterEditHistory.create({
      data: {
        encounterId: encounter.id,
        editedById: staffId,
        reason: reason?.trim() || null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        changedKeys,
      },
    });
  }

  async getEditMeta(
    encounterId: string,
    staffId?: string,
  ): Promise<EncounterEditMeta> {
    const encounter = await this.loadEncounterAccess(encounterId);
    const [editCount, latest] = await Promise.all([
      this.prisma.encounterEditHistory.count({ where: { encounterId } }),
      this.prisma.encounterEditHistory.findFirst({
        where: { encounterId },
        orderBy: { editedAt: 'desc' },
        select: { editedAt: true },
      }),
    ]);

    const shared = isSharedInpatientEncounter(encounter);
    const admissionStatus = encounter.admission?.status ?? null;

    let canEdit = false;
    let canEditAsCoveringPhysician = false;
    if (staffId) {
      const access = await this.canStaffEditEncounter(encounter, staffId);
      canEdit = access.canEdit;
      canEditAsCoveringPhysician = access.canEditAsCoveringPhysician;
    }

    return {
      hasEdits: editCount > 0,
      editCount,
      lastEditedAt: latest?.editedAt?.toISOString() ?? null,
      canEdit,
      requiresVersionedEdits: encounter.status === EncounterStatus.COMPLETED,
      isSharedInpatientEncounter: shared,
      admissionStatus,
      canEditAsCoveringPhysician,
    };
  }
}
