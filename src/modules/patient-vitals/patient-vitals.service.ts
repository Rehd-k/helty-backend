import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePatientVitalsDto,
  QueryPatientVitalsDto,
  UpdatePatientVitalsDto,
} from './dto/patient-vitals.dto';

@Injectable()
export class PatientVitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePatientVitalsDto) {
    const {
      patientId,
      waitingPatientId,
      systolic,
      diastolic,
      temperature,
      height,
      weight,
      bmi,
      pulseRate,
      spo2,
    } = dto;

    if (!waitingPatientId) {
      throw new BadRequestException('waitingPatientId is required.');
    }
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
        data: {
          systolic,
          diastolic,
          temperature,
          height,
          weight,
          bmi,
          pulseRate,
          spo2,
        },
        include: {
          patient: true,
          waitingPatient: true,
        },
      });
    }

    const vitals = await this.prisma.patientVitals.create({
      data: {
        waitingPatient: { connect: { id: waitingPatientId } },
        patient: { connect: { id: waiting.patientId } },
        systolic,
        diastolic,
        temperature,
        height,
        weight,
        bmi,
        pulseRate,
        spo2,
      },
      include: {
        patient: true,
        waitingPatient: true,
      },
    });
    await this.prisma.waitingPatient.update({
      where: { id: waitingPatientId },
      data: {
        vitals: { connect: { id: vitals.id } },
      },
    });
    return vitals;
  }

  async findAll(query: QueryPatientVitalsDto) {
    const { patientId, skip = 0, take = 20 } = query;

    const where = patientId ? { patientId } : {};

    const [data, total] = await Promise.all([
      this.prisma.patientVitals.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
        },
      }),
      this.prisma.patientVitals.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const vitals = await this.prisma.patientVitals.findUnique({
      where: { id },
      include: {
        patient: true,
      },
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
      include: {
        patient: true,
      },
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
      include: {
        patient: true,
      },
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
      include: {
        patient: true,
      },
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
