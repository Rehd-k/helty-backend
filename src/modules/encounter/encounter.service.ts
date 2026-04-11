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
import { labRequestWithBillingInclude } from '../lab-request/lab-request-includes';

@Injectable()
export class EncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
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
          select: {
            id: true,
            firstName: true,
            surname: true,
            patientId: true,
          },
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
          throw new BadRequestException(
            'No paid unsettled consultation invoice item is available for this patient.',
          );
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
            triageNotes: dto.triageNotes,
            status: dto.status ?? EncounterStatus.ONGOING,
            createdById: req.user.sub,
          },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                patientId: true,
              },
            },
            doctor: {
              select: { id: true, firstName: true, lastName: true, staffId: true },
            },
            admission: dto.admissionId
              ? { select: { id: true, status: true } }
              : false,
          },
        });
        await tx.invoice.update({
          where: { id: consultationItem.invoiceId },
          data: { encounterId: encounter.id },
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
        triageNotes: dto.triageNotes,
        status: dto.status ?? EncounterStatus.ONGOING,
        createdById: req.user.sub,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, surname: true, patientId: true },
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
  async startOutpatient(dto: StartOutpatientEncounterDto) {
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
          select: { id: true, firstName: true, surname: true, patientId: true },
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
            data: { seen: true },
          });
        } catch {
          // Don't fail if waiting patient update fails (e.g. wrong id)
        }
      }
      return { encounter: existing, reused: true };
    }

    const createdById = dto.createdById ?? dto.doctorId;

    const encounter = await this.prisma.$transaction(async (tx) => {
      const consultationItem =
        await this.invoiceService.findFirstConsumableConsultationItem(
          tx,
          dto.patientId,
        );
      if (!consultationItem) {
        throw new BadRequestException(
          'No paid unsettled consultation invoice item is available for this patient.',
        );
      }

      const createdEncounter = await tx.encounter.create({
        data: {
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          encounterType: EncounterType.OUTPATIENT,
          startTime: new Date(),
          chiefComplaint: dto.chiefComplaint,
          status: EncounterStatus.ONGOING,
          createdById,
        },
        include: {
          patient: {
            select: { id: true, firstName: true, surname: true, patientId: true },
          },
          doctor: {
            select: { id: true, firstName: true, lastName: true, staffId: true },
          },
        },
      });
      await tx.invoice.update({
        where: { id: consultationItem.invoiceId },
        data: { encounterId: createdEncounter.id },
      });
      return createdEncounter;
    });

    if (dto.waitingPatientId) {
      try {
        await this.prisma.waitingPatient.update({
          where: { id: dto.waitingPatientId },
          data: { seen: true },
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
      startTime?: { gte: Date; lte: Date };
    } = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (encounterType) where.encounterType = encounterType;
    if (status) where.status = status;
    where.startTime = { gte: from, lte: to };

    const [data, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              patientId: true,
            },
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

  async findOne(id: string, expand?: string) {
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
            patientId: true,
            surname: true,
            firstName: true,
            gender: true,
            hmo: true,
            status: true
          }
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
      },
    });
    if (!encounter) throw new NotFoundException(`Encounter "${id}" not found.`);
    return encounter;
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

  async update(id: string, dto: UpdateEncounterDto) {
    await this.findOne(id);

    const data: {
      endTime?: Date;
      chiefComplaint?: string;
      triageNotes?: string;
      status?: EncounterStatus;
      updatedById?: string;
    } = {};
    if (dto.endTime !== undefined) data.endTime = new Date(dto.endTime);
    if (dto.chiefComplaint !== undefined)
      data.chiefComplaint = dto.chiefComplaint;
    if (dto.triageNotes !== undefined) data.triageNotes = dto.triageNotes;
    dto.status === undefined
      ? (data.status = 'ONGOING')
      : (data.status = dto.status);
    if (dto.updatedById !== undefined) data.updatedById = dto.updatedById;

    return this.prisma.encounter.update({
      where: { id },
      data,
      include: {
        patient: {
          select: { id: true, firstName: true, surname: true, patientId: true },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        admission: { select: { id: true, status: true } },
      },
    });
  }

  /** Set encounter status to COMPLETED and endTime to now. */
  async complete(id: string, updatedById?: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.update({
        where: { id },
        data: {
          status: EncounterStatus.COMPLETED,
          endTime: new Date(),
          ...(updatedById && { updatedById }),
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              patientId: true,
            },
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
  async addDiagnosis(encounterId: string, dto: CreateEncounterDiagnosisDto) {
    await this.findOne(encounterId);
    return this.prisma.encounterDiagnosis.create({
      data: {
        encounterId,
        primaryIcdCode: dto.primaryIcdCode,
        primaryIcdDescription: dto.primaryIcdDescription,
        secondaryDiagnosesJson: dto.secondaryDiagnosesJson,
      },
      include: { encounter: { select: { id: true, patientId: true } } },
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
  ) {
    const diagnosis = await this.prisma.encounterDiagnosis.findFirst({
      where: { id: diagnosisId, encounterId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis "${diagnosisId}" not found for this encounter.`,
      );
    }
    return this.prisma.encounterDiagnosis.update({
      where: { id: diagnosisId },
      data: dto,
    });
  }

  async removeDiagnosis(encounterId: string, diagnosisId: string) {
    const diagnosis = await this.prisma.encounterDiagnosis.findFirst({
      where: { id: diagnosisId, encounterId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis "${diagnosisId}" not found for this encounter.`,
      );
    }
    await this.prisma.encounterDiagnosis.delete({ where: { id: diagnosisId } });
    return { message: 'Diagnosis removed successfully.' };
  }
}
