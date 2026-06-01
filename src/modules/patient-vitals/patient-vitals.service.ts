import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdmissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePatientVitalsDto,
  QueryPatientVitalsDto,
  UpdatePatientVitalsDto,
} from './dto/patient-vitals.dto';

type VitalsPayload = {
  systolic?: number;
  diastolic?: number;
  temperature?: number;
  height?: number;
  weight?: number;
  bmi?: number;
  pulseRate?: number;
  spo2?: number;
  painScore?: number;
  notes?: string;
  bloodGlucose?: number;
};

const vitalsInclude = {
  patient: true,
  waitingPatient: true,
  admission: true,
  encounter: true,
  invoice: true,
} as const;

@Injectable()
export class PatientVitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientVitalsDto, staffId?: string) {
    const {
      patientId,
      waitingPatientId,
      admissionId,
      invoiceId,
      encounterId,
      systolic,
      diastolic,
      temperature,
      height,
      weight,
      bmi,
      pulseRate,
      spo2,
      painScore,
      notes,
      bloodGlucose,
    } = dto;
    const targetCount = [
      waitingPatientId,
      admissionId,
      invoiceId,
      encounterId,
    ].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        'Provide exactly one of waitingPatientId, admissionId, invoiceId, or encounterId.',
      );
    }

    const vitalsPayload: VitalsPayload = {
      systolic,
      diastolic,
      temperature,
      height,
      weight,
      bmi,
      pulseRate,
      spo2,
      painScore,
      notes,
      bloodGlucose,
    };

    if (waitingPatientId) {
      return this.createForWaitingPatient(
        waitingPatientId,
        patientId,
        vitalsPayload,
        staffId,
      );
    }

    if (invoiceId) {
      return this.createForInvoice(invoiceId, patientId, vitalsPayload);
    }

    if (encounterId) {
      return this.createForEncounter(
        encounterId,
        patientId,
        vitalsPayload,
        staffId,
      );
    }

    return this.createForAdmission(admissionId!, patientId, vitalsPayload, staffId);
  }

  private async createForEncounter(
    encounterId: string,
    patientId: string | undefined,
    vitalsPayload: VitalsPayload,
    staffId?: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${encounterId}" not found.`);
    }

    if (patientId && patientId !== encounter.patientId) {
      throw new BadRequestException(
        `patientId "${patientId}" does not match the encounter's patientId "${encounter.patientId}".`,
      );
    }

    return this.prisma.patientVitals.create({
      data: {
        encounter: { connect: { id: encounterId } },
        patient: { connect: { id: encounter.patientId } },
        ...(staffId ? { nurse: { connect: { id: staffId } } } : {}),
        ...vitalsPayload,
      },
      include: vitalsInclude,
    });
  }

  private async createForInvoice(
    invoiceId: string,
    patientId: string | undefined,
    vitalsPayload: VitalsPayload,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { vitals: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice "${invoiceId}" not found.`);
    }
    if (patientId && patientId !== invoice.patientId) {
      throw new BadRequestException(
        `patientId "${patientId}" does not match the invoice patientId "${invoice.patientId}".`,
      );
    }

    if (invoice.vitals) {
      return this.prisma.patientVitals.update({
        where: { id: invoice.vitals.id },
        data: vitalsPayload,
        include: vitalsInclude,
      });
    }

    return this.prisma.patientVitals.create({
      data: {
        patient: { connect: { id: invoice.patientId } },
        invoice: { connect: { id: invoiceId } },
        ...vitalsPayload,
      },
      include: vitalsInclude,
    });
  }

  private async createForWaitingPatient(
    waitingPatientId: string,
    patientId: string | undefined,
    vitalsPayload: VitalsPayload,
    staffId?: string,
  ) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const waiting = await this.prisma.waitingPatient.findUnique({
      where: {
        id: waitingPatientId,
        seen: false,
        createdAt: { gte: startOfToday },
      },
      include: { vitals: true },
    });
    if (!waiting) {
      throw new NotFoundException(
        `Waiting patient "${waitingPatientId}" not found.`,
      );
    }

    if (patientId && patientId !== waiting.patientId) {
      throw new BadRequestException(
        `patientId "${patientId}" does not match the waiting patient's patientId "${waiting.patientId}".`,
      );
    }

    // 1:1 (WaitingPatient -> PatientVitals). If vitals already exist, update them instead of creating a second row.
    if (waiting.vitals) {
      return this.prisma.patientVitals.update({
        where: { id: waiting.vitals.id },
        data: vitalsPayload,
        include: vitalsInclude,
      });
    }

    const vitals = await this.prisma.patientVitals.create({
      data: {
        waitingPatient: { connect: { id: waitingPatientId } },
        patient: { connect: { id: waiting.patientId } },
        ...vitalsPayload,
      },
      include: vitalsInclude,
    });
    await this.prisma.waitingPatient.update({
      where: { id: waitingPatientId },
      data: {
        vitals: { connect: { id: vitals.id } },
        ...(staffId ? { updatedById: staffId } : {}),
      },
    });
    return vitals;
  }

  private async createForAdmission(
    admissionId: string,
    patientId: string | undefined,
    vitalsPayload: VitalsPayload,
    staffId?: string,
  ) {
    const admission = await this.prisma.admission.findFirst({
      where: {
        id: admissionId,
        status: AdmissionStatus.ACTIVE,
      },
    });
    if (!admission) {
      throw new NotFoundException(
        `Active admission "${admissionId}" not found.`,
      );
    }

    if (patientId && patientId !== admission.patientId) {
      throw new BadRequestException(
        `patientId "${patientId}" does not match the admission's patientId "${admission.patientId}".`,
      );
    }

    return this.prisma.patientVitals.create({
      data: {
        admission: { connect: { id: admissionId } },
        patient: { connect: { id: admission.patientId } },
        ...(staffId ? { nurse: { connect: { id: staffId } } } : {}),
        ...vitalsPayload,
      },
      include: vitalsInclude,
    });
  }

  async findAll(query: QueryPatientVitalsDto) {
    const { patientId, encounterId, skip = 0, take = 20 } = query;

    const where = {
      ...(patientId ? { patientId } : {}),
      ...(encounterId ? { encounterId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.patientVitals.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: vitalsInclude,
      }),
      this.prisma.patientVitals.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const vitals = await this.prisma.patientVitals.findUnique({
      where: { id },
      include: vitalsInclude,
    });

    if (!vitals) {
      throw new NotFoundException(`Patient vitals "${id}" not found.`);
    }

    return vitals;
  }

  async findByPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    return this.prisma.patientVitals.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: vitalsInclude,
    });
  }

  async findLatestByPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    const vitals = await this.prisma.patientVitals.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: vitalsInclude,
    });

    if (!vitals) {
      throw new NotFoundException(
        `No vitals records found for patient "${patientId}".`,
      );
    }

    return vitals;
  }

  async update(id: string, dto: UpdatePatientVitalsDto) {
    await this.findOne(id);

    const {
      patientId,
      systolic,
      diastolic,
      temperature,
      height,
      weight,
      bmi,
      pulseRate,
      spo2,
    } = dto;

    if (patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: patientId },
      });
      if (!patient) {
        throw new NotFoundException(`Patient "${patientId}" not found.`);
      }
    }

    return this.prisma.patientVitals.update({
      where: { id },
      data: {
        ...(patientId && {
          patient: { connect: { id: patientId } },
        }),
        systolic,
        diastolic,
        temperature,
        height,
        weight,
        bmi,
        pulseRate,
        spo2,
      },
      include: vitalsInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.patientVitals.delete({
      where: { id },
    });

    return { message: 'Patient vitals record deleted successfully.' };
  }
}
