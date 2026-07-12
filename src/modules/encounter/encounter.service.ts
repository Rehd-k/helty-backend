import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateEncounterDto,
  StartOutpatientEncounterDto,
  UpdateEncounterDto,
  QueryEncounterDto,
} from './dto/create-encounter.dto';
import {
  CreateEncounterDiagnosisDto,
  UpdateEncounterDiagnosisDto,
} from './dto/encounter-diagnosis.dto';
import { EncounterType, EncounterStatus } from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';
import { labRequestWithBillingInclude } from '../lab-request/lab-request-includes';
import { EncounterEditPolicyService } from './encounter-edit-policy.service';
import { ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS } from './encounter-clinical-snapshot.types';

type ProcedureConsumableEntry = {
  id?: string;
  consumableId?: string;
  quantity?: number;
  storeLocationId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
};

type ProcedureEntry = {
  id?: string;
  type?: string;
  consent?: string;
  notes?: string;
  complications?: string;
  serviceId?: string;
  invoiceId?: string;
  invoiceItemId?: string;
  consumables?: ProcedureConsumableEntry[];
};

@Injectable()
export class EncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly editPolicy: EncounterEditPolicyService,
  ) { }

  /** Ongoing encounter for the same patient, type, and admission scope (reuse instead of duplicate create). */
  private async findUnfinishedEncounterForCreate(dto: CreateEncounterDto) {
    return this.prisma.encounter.findFirst({
      where: {
        patientId: dto.patientId,
        encounterType: dto.encounterType,
        status: EncounterStatus.ONGOING,
        ...(dto.admissionId != null
          ? { admissionId: dto.admissionId }
          : { admissionId: null }),
      },
      orderBy: { startTime: 'desc' },
      include: {
        patient: {
          select: patientNameFieldsSelect,
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        admission: dto.admissionId
          ? { select: { id: true, status: true } }
          : false,
      },
    });
  }

  async create(dto: CreateEncounterDto, req: any) {
    await this.validatePatientAndDoctor(dto.patientId, dto.doctorId);
    if (dto.admissionId) {
      await this.validateAdmissionForPatient(dto.admissionId, dto.patientId);
    }

    const existing = await this.findUnfinishedEncounterForCreate(dto);
    if (existing) {
      return { encounter: existing, reused: true };
    }

    const encounter = await this.createOne(dto, req);
    return { encounter, reused: false };
  }

  private async createOne(dto: CreateEncounterDto, req: any) {
    if (dto.encounterType === EncounterType.OUTPATIENT) {
      return this.prisma.$transaction(async (tx) => {
        const consultationItem =
          await this.invoiceService.findFirstConsumableConsultationItem(
            tx,
            dto.patientId,
          );
        if (!consultationItem) {
          const reason =
            await this.invoiceService.getConsultationCreditBlockReason(
              tx,
              dto.patientId,
            );
          throw new BadRequestException(reason);
        }

        const encounter = await tx.encounter.create({
          data: {
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            admissionId: dto.admissionId,
            encounterType: dto.encounterType,
            startTime: new Date(Date.now()),
            endTime: dto.endTime ? new Date(dto.endTime) : undefined,
            chiefComplaint: dto.chiefComplaint,
            hpi: dto.hpi,
            pmh: dto.pmh,
            surgicalHistory: dto.surgicalHistory,
            drugHistory: dto.drugHistory,
            allergyHistory: dto.allergyHistory,
            familyHistory: dto.familyHistory,
            socialHistory: dto.socialHistory,
            examinationNotes: dto.examinationNotes,
            soapSubjective: dto.soapSubjective,
            soapObjective: dto.soapObjective,
            soapAssessment: dto.soapAssessment,
            soapPlan: dto.soapPlan,
            triageNotes: dto.triageNotes,
            status: dto.status ?? EncounterStatus.ONGOING,
            createdById: req.user.sub,
          },
          include: {
            patient: {
              select: patientNameFieldsSelect,
            },
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffId: true,
              },
            },
            admission: dto.admissionId
              ? { select: { id: true, status: true } }
              : false,
          },
        });
        await tx.invoice.update({
          where: { id: consultationItem.invoiceId },
          data: {
            encounterId: encounter.id,
            updatedById: req.user.sub,
          },
        });
        return encounter;
      });
    }

    return this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        admissionId: dto.admissionId,
        encounterType: dto.encounterType,
        startTime: new Date(Date.now()),
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        chiefComplaint: dto.chiefComplaint,
        hpi: dto.hpi,
        pmh: dto.pmh,
        surgicalHistory: dto.surgicalHistory,
        drugHistory: dto.drugHistory,
        allergyHistory: dto.allergyHistory,
        familyHistory: dto.familyHistory,
        socialHistory: dto.socialHistory,
        examinationNotes: dto.examinationNotes,
        soapSubjective: dto.soapSubjective,
        soapObjective: dto.soapObjective,
        soapAssessment: dto.soapAssessment,
        soapPlan: dto.soapPlan,
        triageNotes: dto.triageNotes,
        status: dto.status ?? EncounterStatus.ONGOING,
        createdById: req.user.sub,
      },
      include: {
        patient: {
          select: { ...patientNameFieldsSelect },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        admission: dto.admissionId
          ? { select: { id: true, status: true } }
          : false,
      },
    });
  }

  /** Start an outpatient encounter; optionally mark a waiting-patient entry as seen. */
  async startOutpatient(
    dto: StartOutpatientEncounterDto,
    req: { user: { sub: string } },
  ) {
    await this.validatePatientAndDoctor(dto.patientId, dto.doctorId);

    const existing = await this.prisma.encounter.findFirst({
      where: {
        patientId: dto.patientId,
        encounterType: EncounterType.OUTPATIENT,
        status: EncounterStatus.ONGOING,
        admissionId: null,
      },
      orderBy: { startTime: 'desc' },
      include: {
        patient: {
          select: { ...patientNameFieldsSelect },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
      },
    });
    if (existing) {
      if (dto.waitingPatientId) {
        try {
          await this.prisma.waitingPatient.update({
            where: { id: dto.waitingPatientId },
            data: { seen: true, updatedById: req.user.sub },
          });
        } catch {
          // Don't fail if waiting patient update fails (e.g. wrong id)
        }
      }
      return { encounter: existing, reused: true };
    }

    const createdById = req.user.sub;

    const encounter = await this.prisma.$transaction(async (tx) => {
      const consultationItem =
        await this.invoiceService.findFirstConsumableConsultationItem(
          tx,
          dto.patientId,
        );
      if (!consultationItem) {
        const reason =
          await this.invoiceService.getConsultationCreditBlockReason(
            tx,
            dto.patientId,
          );
        throw new BadRequestException(reason);
      }

      const createdEncounter = await tx.encounter.create({
        data: {
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          encounterType: EncounterType.OUTPATIENT,
          startTime: new Date(),
          chiefComplaint: dto.chiefComplaint,
          hpi: dto.hpi,
          pmh: dto.pmh,
          surgicalHistory: dto.surgicalHistory,
          drugHistory: dto.drugHistory,
          allergyHistory: dto.allergyHistory,
          familyHistory: dto.familyHistory,
          socialHistory: dto.socialHistory,
          examinationNotes: dto.examinationNotes,
          soapSubjective: dto.soapSubjective,
          soapObjective: dto.soapObjective,
          soapAssessment: dto.soapAssessment,
          soapPlan: dto.soapPlan,
          status: EncounterStatus.ONGOING,
          createdById,
        },
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
        },
      });
      await tx.invoice.update({
        where: { id: consultationItem.invoiceId },
        data: {
          encounterId: createdEncounter.id,
          updatedById: req.user.sub,
        },
      });
      return createdEncounter;
    });

    if (dto.waitingPatientId) {
      try {
        await this.prisma.waitingPatient.update({
          where: { id: dto.waitingPatientId },
          data: { seen: true, updatedById: req.user.sub },
        });
      } catch {
        // Don't fail the encounter creation if waiting patient update fails (e.g. wrong id)
      }
    }

    return { encounter, reused: false };
  }

  async findAll(query: QueryEncounterDto) {
    const {
      patientId,
      doctorId,
      encounterType,
      status,
      skip = 0,
      take = 20,
      fromDate,
      toDate,
    } = query;
    const { from, to } = parseDateRange(fromDate, toDate);
    const where: {
      patientId?: string;
      doctorId?: string;
      encounterType?: EncounterType;
      status?: EncounterStatus;
      updatedAt?: { gte: Date; lte: Date };
    } = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (encounterType) where.encounterType = encounterType;
    if (status) where.status = status;
    where.updatedAt = { gte: from, lte: to };

    const [data, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
          admission: { select: { id: true, status: true } },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string, expand?: string, staffId?: string) {
    const expandSet = expand
      ? new Set(expand.split(',').map((s) => s.trim().toLowerCase()))
      : new Set<string>();
    const encounterBase = await this.prisma.encounter.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });
    if (!encounterBase) {
      throw new NotFoundException(`Encounter "${id}" not found.`);
    }

    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            ...patientNameFieldsSelect,
            hmo: true,
            status: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffId: true,
            staffRole: true,
            accountType: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffId: true,
          },
        },
        admission: true,
        appointment: expandSet.has('appointment') || expandSet.has('*'),
        doctorReports: { where: { encounterId: encounterBase.id } },
        prescriptions: {
          where: {
            encounterId: encounterBase.id,
            patientId: encounterBase.patientId,
          },
        },
        labReports: {
          where: {
            encounterId: encounterBase.id,
            patientId: encounterBase.patientId,
          },
        },
        radiologyReports: {
          where: {
            encounterId: encounterBase.id,
            patientId: encounterBase.patientId,
          },
        },
        diagnoses: true,
        labRequests: {
          where: {
            encounterId: encounterBase.id,
            patientId: encounterBase.patientId,
          },
          include: labRequestWithBillingInclude,
        },
        radiologyOrders: { where: { encounterId: encounterBase.id } },
        medicationOrders:
          expandSet.has('medicationorders') || expandSet.has('*'),
        legacyLabOrders: expandSet.has('laborders') || expandSet.has('*'),
        specialtyModules:
          expandSet.has('specialtymodules') || expandSet.has('*'),
        clinicalSections:
          expandSet.has('clinicalsections') || expandSet.has('*'),
      },
    });
    if (!encounter) throw new NotFoundException(`Encounter "${id}" not found.`);
    const editMeta = await this.editPolicy.getEditMeta(id, staffId);
    return { ...encounter, editMeta };
  }

  async listEditHistory(encounterId: string) {
    await this.editPolicy.loadEncounterAccess(encounterId);
    return this.prisma.encounterEditHistory.findMany({
      where: { encounterId },
      orderBy: { editedAt: 'desc' },
      select: {
        id: true,
        editedAt: true,
        reason: true,
        changedKeys: true,
        editedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffId: true,
          },
        },
      },
    });
  }

  async getEditHistoryEntry(encounterId: string, historyId: string) {
    await this.editPolicy.loadEncounterAccess(encounterId);
    const entry = await this.prisma.encounterEditHistory.findFirst({
      where: { id: historyId, encounterId },
      include: {
        editedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffId: true,
          },
        },
      },
    });
    if (!entry) {
      throw new NotFoundException(
        `Edit history "${historyId}" not found for this encounter.`,
      );
    }
    return entry;
  }

  async findByPatientId(patientId: string) {
    return this.prisma.encounter.findMany({
      where: { patientId },
      orderBy: { startTime: 'desc' },
      include: {
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
      },
    });
  }

  async update(
    id: string,
    dto: UpdateEncounterDto,
    staffId: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(id, staffId);

    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        proceduresJson: true,
        status: true,
      },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${id}" not found.`);
    }
    

    if (
      access.status === EncounterStatus.COMPLETED &&
      dto.status === EncounterStatus.ONGOING
    ) {
      throw new BadRequestException(
        'Cannot reopen a completed encounter via update. Status changes are not allowed after completion.',
      );
    }

    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(id)
        : null;

    const patchFields: Partial<
      Record<(typeof ENCOUNTER_CLINICAL_SNAPSHOT_FIELDS)[number], string>
    > = {};
    if (dto.chiefComplaint !== undefined)
      patchFields.chiefComplaint = dto.chiefComplaint;
    if (dto.hpi !== undefined) patchFields.hpi = dto.hpi;
    if (dto.pmh !== undefined) patchFields.pmh = dto.pmh;
    if (dto.surgicalHistory !== undefined)
      patchFields.surgicalHistory = dto.surgicalHistory;
    if (dto.drugHistory !== undefined) patchFields.drugHistory = dto.drugHistory;
    if (dto.allergyHistory !== undefined)
      patchFields.allergyHistory = dto.allergyHistory;
    if (dto.familyHistory !== undefined)
      patchFields.familyHistory = dto.familyHistory;
    if (dto.socialHistory !== undefined)
      patchFields.socialHistory = dto.socialHistory;
    if (dto.examinationNotes !== undefined)
      patchFields.examinationNotes = dto.examinationNotes;
    if (dto.soapSubjective !== undefined)
      patchFields.soapSubjective = dto.soapSubjective;
    if (dto.soapObjective !== undefined)
      patchFields.soapObjective = dto.soapObjective;
    if (dto.soapAssessment !== undefined)
      patchFields.soapAssessment = dto.soapAssessment;
    if (dto.soapPlan !== undefined) patchFields.soapPlan = dto.soapPlan;
    if (dto.triageNotes !== undefined) patchFields.triageNotes = dto.triageNotes;

    let proceduresJson: string | undefined;
    if (dto.proceduresJson !== undefined) {
      proceduresJson = await this.syncEncounterProceduresBilling(
        encounter,
        dto.proceduresJson,
        staffId,
      );
      patchFields.proceduresJson = proceduresJson;
    }

    const changedKeys =
      snapshotBefore != null
        ? this.editPolicy.computeEncounterFieldChanges(
          snapshotBefore,
          patchFields,
        )
        : [];

    const data: {
      endTime?: Date;
      chiefComplaint?: string;
      hpi?: string;
      pmh?: string;
      surgicalHistory?: string;
      drugHistory?: string;
      allergyHistory?: string;
      familyHistory?: string;
      socialHistory?: string;
      examinationNotes?: string;
      soapSubjective?: string;
      soapObjective?: string;
      soapAssessment?: string;
      soapPlan?: string;
      triageNotes?: string;
      proceduresJson?: string;
      status?: EncounterStatus;
      updatedById: string;
    } = { updatedById: staffId };
    if (dto.endTime !== undefined) data.endTime = new Date(dto.endTime);
    if (dto.chiefComplaint !== undefined)
      data.chiefComplaint = dto.chiefComplaint;
    if (dto.hpi !== undefined) data.hpi = dto.hpi;
    if (dto.pmh !== undefined) data.pmh = dto.pmh;
    if (dto.surgicalHistory !== undefined)
      data.surgicalHistory = dto.surgicalHistory;
    if (dto.drugHistory !== undefined) data.drugHistory = dto.drugHistory;
    if (dto.allergyHistory !== undefined)
      data.allergyHistory = dto.allergyHistory;
    if (dto.familyHistory !== undefined) data.familyHistory = dto.familyHistory;
    if (dto.socialHistory !== undefined) data.socialHistory = dto.socialHistory;
    if (dto.examinationNotes !== undefined)
      data.examinationNotes = dto.examinationNotes;
    if (dto.soapSubjective !== undefined)
      data.soapSubjective = dto.soapSubjective;
    if (dto.soapObjective !== undefined) data.soapObjective = dto.soapObjective;
    if (dto.soapAssessment !== undefined)
      data.soapAssessment = dto.soapAssessment;
    if (dto.soapPlan !== undefined) data.soapPlan = dto.soapPlan;
    if (dto.triageNotes !== undefined) data.triageNotes = dto.triageNotes;
    if (proceduresJson !== undefined) data.proceduresJson = proceduresJson;
    if (dto.status !== undefined) data.status = dto.status;

    const hasClinicalPatch = changedKeys.length > 0;
    const hasOtherPatch =
      dto.endTime !== undefined ||
      (dto.status !== undefined && dto.status !== access.status);

    if (
      snapshotBefore != null &&
      !hasClinicalPatch &&
      !hasOtherPatch
    ) {
      throw new BadRequestException('No clinical fields were changed.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (snapshotBefore != null && changedKeys.length > 0) {
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          changedKeys,
          dto.editReason,
          tx,
        );
      }

      return tx.encounter.update({
        where: { id },
        data,
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
          admission: { select: { id: true, status: true } },
          updatedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    });
  }

  private parseProceduresJson(raw: string | null | undefined): ProcedureEntry[] {
    if (raw == null || raw.trim() === '') return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('proceduresJson must be valid JSON.');
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('proceduresJson must be a JSON array.');
    }
    return parsed as ProcedureEntry[];
  }

  private collectProcedureBilledIds(procedures: ProcedureEntry[]): Set<string> {
    const ids = new Set<string>();
    for (const proc of procedures) {
      if (proc.invoiceItemId) ids.add(proc.invoiceItemId);
      for (const c of proc.consumables ?? []) {
        if (c.invoiceItemId) ids.add(c.invoiceItemId);
      }
    }
    return ids;
  }

  private matchProcedureEntry(
    old: ProcedureEntry[],
    entry: ProcedureEntry,
  ): ProcedureEntry | undefined {
    if (entry.id) return old.find((o) => o.id === entry.id);
    if (entry.invoiceItemId) {
      return old.find((o) => o.invoiceItemId === entry.invoiceItemId);
    }
    if (entry.serviceId && entry.type) {
      return old.find(
        (o) => o.serviceId === entry.serviceId && o.type === entry.type,
      );
    }
    return undefined;
  }

  private matchConsumableEntry(
    old: ProcedureConsumableEntry[],
    entry: ProcedureConsumableEntry,
  ): ProcedureConsumableEntry | undefined {
    if (entry.id) return old.find((o) => o.id === entry.id);
    if (entry.invoiceItemId) {
      return old.find((o) => o.invoiceItemId === entry.invoiceItemId);
    }
    if (entry.consumableId) {
      return old.find((o) => o.consumableId === entry.consumableId);
    }
    return undefined;
  }

  private mergeProcedureWithPrevious(
    entry: ProcedureEntry,
    previous?: ProcedureEntry,
  ): ProcedureEntry {
    const merged: ProcedureEntry = { ...entry };
    if (previous) {
      if (!merged.invoiceItemId && previous.invoiceItemId) {
        merged.invoiceItemId = previous.invoiceItemId;
        merged.invoiceId = previous.invoiceId;
      }
      if (merged.consumables?.length) {
        merged.consumables = merged.consumables.map((c) => {
          const prevC = previous.consumables
            ? this.matchConsumableEntry(previous.consumables, c)
            : undefined;
          if (!prevC) return { ...c };
          return {
            ...c,
            invoiceItemId: c.invoiceItemId ?? prevC.invoiceItemId,
            invoiceId: c.invoiceId ?? prevC.invoiceId,
          };
        });
      }
    }
    return merged;
  }

  private async syncEncounterProceduresBilling(
    encounter: {
      id: string;
      patientId: string;
      doctorId: string;
      proceduresJson: string | null;
    },
    rawProceduresJson: string,
    staffId: string,
  ): Promise<string> {
    const old = this.parseProceduresJson(encounter.proceduresJson);
    const next = this.parseProceduresJson(rawProceduresJson);
    const oldIds = this.collectProcedureBilledIds(old);
    const newIds = this.collectProcedureBilledIds(next);

    await this.prisma.$transaction(async (tx) => {
      for (const invoiceItemId of oldIds) {
        if (!newIds.has(invoiceItemId)) {
          await this.invoiceService.removeBillableLineForEncounterRequest(
            invoiceItemId,
            tx,
          );
        }
      }
    });

    const billingStaffId = staffId || encounter.doctorId;
    const merged = next.map((entry) =>
      this.mergeProcedureWithPrevious(
        entry,
        this.matchProcedureEntry(old, entry),
      ),
    );

    for (const proc of merged) {
      if (proc.serviceId && !proc.invoiceItemId) {
        await this.invoiceService.assertServiceCategoryForProcedureBilling(
          proc.serviceId,
        );
        const { invoice, invoiceItemId } =
          await this.invoiceService.createWithServiceItem({
            patientId: encounter.patientId,
            encounterId: encounter.id,
            staffId: billingStaffId,
            serviceId: proc.serviceId,
          });
        proc.invoiceId = invoice.id;
        proc.invoiceItemId = invoiceItemId;
      }

      if (proc.consumables?.length) {
        for (const consumable of proc.consumables) {
          if (!consumable.consumableId || consumable.invoiceItemId) continue;
          if (!consumable.storeLocationId) {
            throw new BadRequestException(
              'storeLocationId is required for each billable procedure consumable.',
            );
          }
          const unitPrice = await this.resolveConsumableUnitPrice(
            consumable.consumableId,
            consumable.storeLocationId,
          );
          const invoice = await this.invoiceService.ensureInvoiceForEncounter({
            encounterId: encounter.id,
            patientId: encounter.patientId,
            staffId: billingStaffId,
          });
          const item = await this.invoiceService.addItem(
            invoice.id,
            {
              consumableId: consumable.consumableId,
              storeLocationId: consumable.storeLocationId,
              quantity: consumable.quantity ?? 1,
              unitPrice,
            },
            billingStaffId,
          );
          consumable.invoiceId = invoice.id;
          consumable.invoiceItemId = item.id;
        }
      }
    }

    return JSON.stringify(merged);
  }

  private async resolveConsumableUnitPrice(
    consumableId: string,
    storeLocationId: string,
  ): Promise<number> {
    const batch = await this.prisma.consumableBatch.findFirst({
      where: {
        consumableId,
        storeLocationId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: { expiryDate: 'asc' },
      select: { sellingPrice: true },
    });
    return batch ? Number(batch.sellingPrice) : 0;
  }

  /** Set encounter status to COMPLETED and endTime to now. */
  async complete(id: string, staffId: string) {
    await this.editPolicy.assertCanEdit(id, staffId);
    return this.prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.update({
        where: { id },
        data: {
          status: EncounterStatus.COMPLETED,
          endTime: new Date(),
          updatedById: staffId,
        },
        include: {
          patient: {
            select: patientNameFieldsSelect,
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              staffId: true,
            },
          },
          updatedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      if (encounter.encounterType === EncounterType.OUTPATIENT) {
        await this.invoiceService.settleConsultationItemsForEncounter(tx, id);
      }
      return encounter;
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.encounter.delete({ where: { id } });
    return { message: 'Encounter removed successfully.' };
  }

  private async validatePatientAndDoctor(patientId: string, doctorId: string) {
    const [patient, doctor] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.prisma.staff.findUnique({ where: { id: doctorId } }),
    ]);
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }
    if (!doctor) {
      throw new NotFoundException(`Staff (doctor) "${doctorId}" not found.`);
    }
  }

  private async validateAdmissionForPatient(
    admissionId: string,
    patientId: string,
  ) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: admissionId },
      include: { encounter: true },
    });
    if (!admission) {
      throw new NotFoundException(`Admission "${admissionId}" not found.`);
    }
    if (admission.patientId !== patientId) {
      throw new BadRequestException(
        'Admission does not belong to the given patient.',
      );
    }
    if (admission.encounter) {
      throw new BadRequestException(
        'This admission is already linked to an encounter. One admission can only have one encounter.',
      );
    }
  }

  // --- Encounter diagnoses (structured diagnosis per encounter) ---
  async addDiagnosis(
    encounterId: string,
    dto: CreateEncounterDiagnosisDto,
    staffId: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(encounterId, staffId);
    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(encounterId)
        : null;

    return this.prisma.$transaction(async (tx) => {
      if (snapshotBefore) {
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          ['diagnoses.add'],
          dto.editReason,
          tx,
        );
      }
      return tx.encounterDiagnosis.create({
        data: {
          encounterId,
          primaryIcdCode: dto.primaryIcdCode,
          primaryIcdDescription: dto.primaryIcdDescription,
          secondaryDiagnosesJson: dto.secondaryDiagnosesJson,
        },
        include: { encounter: { select: { id: true, patientId: true } } },
      });
    });
  }

  async getDiagnoses(encounterId: string) {
    await this.findOne(encounterId);
    return this.prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async updateDiagnosis(
    encounterId: string,
    diagnosisId: string,
    dto: UpdateEncounterDiagnosisDto,
    staffId: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(encounterId, staffId);
    const diagnosis = await this.prisma.encounterDiagnosis.findFirst({
      where: { id: diagnosisId, encounterId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis "${diagnosisId}" not found for this encounter.`,
      );
    }

    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(encounterId)
        : null;

    const { editReason, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (snapshotBefore) {
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          [`diagnoses.${diagnosisId}`],
          editReason,
          tx,
        );
      }
      return tx.encounterDiagnosis.update({
        where: { id: diagnosisId },
        data: updateData,
      });
    });
  }

  async removeDiagnosis(
    encounterId: string,
    diagnosisId: string,
    staffId: string,
    editReason?: string,
  ) {
    const access = await this.editPolicy.assertCanEdit(encounterId, staffId);
    const diagnosis = await this.prisma.encounterDiagnosis.findFirst({
      where: { id: diagnosisId, encounterId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis "${diagnosisId}" not found for this encounter.`,
      );
    }

    const snapshotBefore =
      access.status === EncounterStatus.COMPLETED
        ? await this.editPolicy.buildClinicalSnapshot(encounterId)
        : null;

    await this.prisma.$transaction(async (tx) => {
      if (snapshotBefore) {
        await this.editPolicy.recordEditIfCompleted(
          access,
          staffId,
          snapshotBefore,
          [`diagnoses.${diagnosisId}.removed`],
          editReason,
          tx,
        );
      }
      await tx.encounterDiagnosis.delete({ where: { id: diagnosisId } });
    });
    return { message: 'Diagnosis removed successfully.' };
  }
}
