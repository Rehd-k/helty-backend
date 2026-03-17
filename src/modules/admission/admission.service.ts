import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
} from './dto/create-admission.dto';

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) { }

  async create(createAdmissionDto: CreateAdmissionDto, @Req() req: any) {
    const [patient, encounter] = await Promise.all([
      this.prisma.patient.findUnique({
        where: { id: createAdmissionDto.patientId },
      }),
      this.prisma.encounter.findUnique({
        where: { id: createAdmissionDto.encounterId },
      }),
    ]);

    if (!patient) {
      throw new NotFoundException(
        `Patient "${createAdmissionDto.patientId}" not found.`,
      );
    }
    if (!encounter) {
      throw new NotFoundException(
        `Encounter "${createAdmissionDto.encounterId}" not found.`,
      );
    }
    if (encounter.patientId !== createAdmissionDto.patientId) {
      throw new BadRequestException(
        'Encounter does not belong to the given patient.',
      );
    }
    if (encounter.admissionId) {
      throw new BadRequestException(
        'This encounter is already linked to an admission. One encounter can only have one admission.',
      );
    }

    const admission = await this.prisma.admission.create({
      data: {
        patientId: createAdmissionDto.patientId,
        admissionDate: new Date(Date.now()),
        dischargeDate: createAdmissionDto.dischargeDate
          ? new Date(createAdmissionDto.dischargeDate)
          : null,
        bedId: createAdmissionDto.bedId,
        wardId: createAdmissionDto.wardId,
        ward: createAdmissionDto.ward,
        room: createAdmissionDto.room,
        reason: createAdmissionDto.reason,
        createdById: req.user.sub,
        ...(createAdmissionDto.attendingDoctorId && {
          attendingDoctorId: createAdmissionDto.attendingDoctorId,
        }),
      },
    });

    await this.prisma.encounter.update({
      where: { id: createAdmissionDto.encounterId },
      data: { admissionId: admission.id },
    });

    return this.prisma.admission.findUnique({
      where: { id: admission.id },
      include: {
        patient: true,
        wardEntity: true,
        bed: true,
        encounter: true,
      },
    });
  }

  async findAll(
    skip = 0,
    take = 10,
    filters?: { status?: string; attendingDoctorId?: string },
  ) {
    const statusValue =
      filters?.status === 'admitted' ? 'ACTIVE' : filters?.status;
    const where: any = {};
    if (statusValue) where.status = statusValue;
    if (filters?.attendingDoctorId)
      where.attendingDoctorId = filters.attendingDoctorId;

    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take,
        include: {
          patient: true,
          wardEntity: true,
          bed: true,
          encounter: true,
        },
        orderBy: { admissionDate: 'desc' },
      }),
      this.prisma.admission.count({ where }),
    ]);
    return { admissions, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: true,
        wardEntity: true,
        bed: true,
        encounter: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.admission.findMany({
      where: { patientId },
      orderBy: { admissionDate: 'desc' },
      include: {
        patient: true,
        encounter: true,
      },
    });
  }

  async getActiveAdmissions() {
    return this.prisma.admission.findMany({
      where: {
        dischargeDate: null,
      },
      include: {
        patient: true,
        encounter: true,
      },
      orderBy: { admissionDate: 'asc' },
    });
  }

  async update(id: string, updateAdmissionDto: UpdateAdmissionDto) {
    return this.prisma.admission.update({
      where: { id },
      data: {
        ...(updateAdmissionDto.dischargeDate && {
          dischargeDate: new Date(updateAdmissionDto.dischargeDate),
        }),
        ward: updateAdmissionDto.ward,
        room: updateAdmissionDto.room,
        reason: updateAdmissionDto.reason,
        ...(updateAdmissionDto.attendingDoctorId !== undefined && {
          attendingDoctorId: updateAdmissionDto.attendingDoctorId || null,
        }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.admission.delete({
      where: { id },
    });
  }
}
