import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class EncounterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEncounterDto) {
    await this.validatePatientAndDoctor(dto.patientId, dto.doctorId);
    if (dto.admissionId) {
      await this.validateAdmissionForPatient(dto.admissionId, dto.patientId);
    }

    return this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        admissionId: dto.admissionId,
        encounterType: dto.encounterType,
        startTime: new Date(dto.startTime),
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        chiefComplaint: dto.chiefComplaint,
        triageNotes: dto.triageNotes,
        status: dto.status ?? EncounterStatus.ONGOING,
        createdById: dto.createdById,
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
        admission: dto.admissionId ? { select: { id: true, status: true } } : false,
      },
    });
  }

  /** Start an outpatient encounter; optionally mark a waiting-patient entry as seen. */
  async startOutpatient(dto: StartOutpatientEncounterDto) {
    await this.validatePatientAndDoctor(dto.patientId, dto.doctorId);

    const createdById = dto.createdById ?? dto.doctorId;

    const encounter = await this.prisma.encounter.create({
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
        patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
      },
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

    return encounter;
  }

  async findAll(query: QueryEncounterDto) {
    const { patientId, doctorId, encounterType, status, skip = 0, take = 20 } = query;
    const where: {
      patientId?: string;
      doctorId?: string;
      encounterType?: EncounterType;
      status?: EncounterStatus;
    } = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (encounterType) where.encounterType = encounterType;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
          doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
          admission: { select: { id: true, status: true } },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true, role: true } },
        admission: true,
        doctorReports: true,
        prescriptions: true,
        labReports: true,
        radiologyReports: true,
        diagnoses: true,
        labRequests: true,
        imagingRequests: true,
      },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${id}" not found.`);
    }
    return encounter;
  }

  async findByPatientId(patientId: string) {
    return this.prisma.encounter.findMany({
      where: { patientId },
      orderBy: { startTime: 'desc' },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
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
    if (dto.chiefComplaint !== undefined) data.chiefComplaint = dto.chiefComplaint;
    if (dto.triageNotes !== undefined) data.triageNotes = dto.triageNotes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.updatedById !== undefined) data.updatedById = dto.updatedById;

    return this.prisma.encounter.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
        admission: { select: { id: true, status: true } },
      },
    });
  }

  /** Set encounter status to COMPLETED and endTime to now. */
  async complete(id: string, updatedById?: string) {
    await this.findOne(id);
    return this.prisma.encounter.update({
      where: { id },
      data: {
        status: EncounterStatus.COMPLETED,
        endTime: new Date(),
        ...(updatedById && { updatedById }),
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, staffId: true } },
      },
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

  private async validateAdmissionForPatient(admissionId: string, patientId: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: admissionId },
    });
    if (!admission) {
      throw new NotFoundException(`Admission "${admissionId}" not found.`);
    }
    if (admission.patientId !== patientId) {
      throw new BadRequestException(
        'Admission does not belong to the given patient.',
      );
    }
  }

  // --- Encounter diagnoses (structured diagnosis per encounter) ---
  async addDiagnosis(encounterId: string, dto: CreateEncounterDiagnosisDto) {
    await this.findOne(encounterId);
    return this.prisma.encounterDiagnosis.create({
      data: {
        encounterId,
        diagnosis: dto.diagnosis,
        isPrimary: dto.isPrimary ?? false,
      },
      include: { encounter: { select: { id: true, patientId: true } } },
    });
  }

  async getDiagnoses(encounterId: string) {
    await this.findOne(encounterId);
    return this.prisma.encounterDiagnosis.findMany({
      where: { encounterId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
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
