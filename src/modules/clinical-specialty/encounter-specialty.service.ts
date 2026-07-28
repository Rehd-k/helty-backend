import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MedicalSpecialty, Prisma } from '@prisma/client';
import { EncounterStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncounterEditPolicyService } from '../encounter/encounter-edit-policy.service';
import {
  CATALOG_VERSION,
  CLINICAL_SPECIALTY_CATALOG,
  getCatalogEntry,
  isSectionKeyAllowed,
  MAX_SECTION_JSON_BYTES,
} from './clinical-specialty-catalog';
import { SyncSpecialtyModulesDto } from './dto/sync-specialty-modules.dto';
import { UpsertClinicalSectionDto } from './dto/upsert-clinical-section.dto';
import { ListClinicalSectionsQueryDto } from './dto/list-clinical-sections.query.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class EncounterSpecialtyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editPolicy: EncounterEditPolicyService,
  ) {}

  getCatalog() {
    return {
      catalogVersion: CATALOG_VERSION,
      specialties: CLINICAL_SPECIALTY_CATALOG,
    };
  }

  private async ensureEncounter(encounterId: string) {
    const e = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true },
    });
    if (!e) {
      throw new NotFoundException(`Encounter "${encounterId}" not found.`);
    }
  }

  private validateEnabledKeys(specialty: MedicalSpecialty, keys: string[]) {
    const entry = getCatalogEntry(specialty);
    if (!entry) {
      throw new BadRequestException(`Unknown specialty: ${specialty}`);
    }
    const seen = new Set<string>();
    for (const key of keys) {
      if (!key?.trim()) {
        throw new BadRequestException('Section keys must be non-empty strings.');
      }
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate section key: ${key}`);
      }
      seen.add(key);
      if (!isSectionKeyAllowed(specialty, key)) {
        throw new BadRequestException(
          `Section "${key}" is not valid for specialty ${specialty}.`,
        );
      }
    }
  }

  private assertJsonSize(data: unknown) {
    const json = JSON.stringify(data ?? {});
    if (Buffer.byteLength(json, 'utf8') > MAX_SECTION_JSON_BYTES) {
      throw new BadRequestException(
        `Section data exceeds maximum size (${MAX_SECTION_JSON_BYTES} bytes).`,
      );
    }
  }

  async listModules(encounterId: string) {
    await this.ensureEncounter(encounterId);
    return this.prisma.encounterSpecialtyModule.findMany({
      where: { encounterId },
      orderBy: { specialty: 'asc' },
      include: {
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  /** Full replacement: body.modules is the complete desired set per specialty. */
  async syncModules(
    encounterId: string,
    dto: SyncSpecialtyModulesDto,
    staffId: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(encounterId, staffId);

    const incoming = new Map<MedicalSpecialty, string[]>();
    for (const m of dto.modules) {
      this.validateEnabledKeys(m.specialty, m.enabledSectionKeys);
      incoming.set(m.specialty, m.enabledSectionKeys);
    }

    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(encounterId)
        : null;

    await this.prisma.$transaction(async (tx) => {
      if (snapshotBefore) {
        const incomingModules = dto.modules.map((m) => ({
          specialty: m.specialty,
          enabledSectionKeys: m.enabledSectionKeys,
        }));
        const enabledKeysBySpecialty = new Map(
          incomingModules.map((m) => [m.specialty, m.enabledSectionKeys as string[]]),
        );
        const afterSections = snapshotBefore.clinicalSections.filter((s) => {
          const keys = enabledKeysBySpecialty.get(s.specialty);
          if (!keys) return false;
          return keys.includes(s.sectionKey);
        });
        const afterPreview = {
          ...snapshotBefore,
          specialtyModules: incomingModules,
          clinicalSections: afterSections,
        };
        const changedKeys = this.editPolicy.computeChangedKeys(
          snapshotBefore,
          afterPreview,
        );
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          changedKeys,
          dto.editReason,
          tx,
        );
      }
      const existing = await tx.encounterSpecialtyModule.findMany({
        where: { encounterId },
      });
      const incomingSpecs = new Set(incoming.keys());

      for (const row of existing) {
        if (!incomingSpecs.has(row.specialty)) {
          await tx.encounterClinicalSection.deleteMany({
            where: { encounterId, specialty: row.specialty },
          });
          await tx.encounterSpecialtyModule.delete({
            where: {
              encounterId_specialty: {
                encounterId,
                specialty: row.specialty,
              },
            },
          });
        }
      }

      for (const [specialty, keys] of incoming) {
        const keyList = [...keys];
        await tx.encounterClinicalSection.deleteMany({
          where: {
            encounterId,
            specialty,
            ...(keyList.length > 0
              ? { sectionKey: { notIn: keyList } }
              : {}),
          },
        });

        await tx.encounterSpecialtyModule.upsert({
          where: {
            encounterId_specialty: { encounterId, specialty },
          },
          create: {
            encounterId,
            specialty,
            enabledSectionKeys: keyList,
            createdById: staffId,
            updatedById: staffId,
          },
          update: {
            enabledSectionKeys: keyList,
            updatedById: staffId,
          },
        });
      }
    });

    return this.listModules(encounterId);
  }

  async listClinicalSections(
    encounterId: string,
    query: ListClinicalSectionsQueryDto,
  ) {
    await this.ensureEncounter(encounterId);
    const keys =
      query.keys
        ?.split(',')
        .map((k) => k.trim())
        .filter(Boolean) ?? undefined;

    return this.prisma.encounterClinicalSection.findMany({
      where: {
        encounterId,
        ...(query.specialty != null ? { specialty: query.specialty } : {}),
        ...(keys?.length ? { sectionKey: { in: keys } } : {}),
      },
      orderBy: [{ specialty: 'asc' }, { sectionKey: 'asc' }],
      include: {
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async upsertClinicalSection(
    encounterId: string,
    specialty: MedicalSpecialty,
    sectionKey: string,
    dto: UpsertClinicalSectionDto,
    staffId: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(encounterId, staffId);

    if (!isSectionKeyAllowed(specialty, sectionKey)) {
      throw new BadRequestException(
        `Section "${sectionKey}" is not valid for specialty ${specialty}.`,
      );
    }

    const moduleRow = await this.prisma.encounterSpecialtyModule.findUnique({
      where: {
        encounterId_specialty: { encounterId, specialty },
      },
    });
    if (!moduleRow) {
      throw new BadRequestException(
        `Enable specialty ${specialty} on this encounter before saving section "${sectionKey}".`,
      );
    }
    const enabled = moduleRow.enabledSectionKeys as string[];
    if (!Array.isArray(enabled) || !enabled.includes(sectionKey)) {
      throw new BadRequestException(
        `Section "${sectionKey}" is not enabled for this encounter. Sync specialty modules first.`,
      );
    }

    this.assertJsonSize(dto.data);
    const data = dto.data as Prisma.InputJsonValue;
    const schemaVersion = dto.schemaVersion ?? 1;

    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(encounterId)
        : null;

    const sectionPath = `${specialty}.${sectionKey}`;
    const existingSection = snapshotBefore?.clinicalSections.find(
      (s) => s.specialty === specialty && s.sectionKey === sectionKey,
    );
    const dataUnchanged =
      existingSection != null &&
      existingSection.schemaVersion === schemaVersion &&
      JSON.stringify(existingSection.data) === JSON.stringify(dto.data);

    if (snapshotBefore && dataUnchanged) {
      return this.prisma.encounterClinicalSection.findUniqueOrThrow({
        where: {
          encounterId_specialty_sectionKey: {
            encounterId,
            specialty,
            sectionKey,
          },
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (snapshotBefore) {
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          [`clinicalSections.${sectionPath}`],
          dto.editReason,
          tx,
        );
      }

      return tx.encounterClinicalSection.upsert({
        where: {
          encounterId_specialty_sectionKey: {
            encounterId,
            specialty,
            sectionKey,
          },
        },
        create: {
          encounterId,
          specialty,
          sectionKey,
          schemaVersion,
          data,
          createdById: staffId,
          updatedById: staffId,
        },
        update: {
          schemaVersion,
          data,
          updatedById: staffId,
        },
      });
    });
  }
}
