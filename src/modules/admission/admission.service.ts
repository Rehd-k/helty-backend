import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdmissionDto, UpdateAdmissionDto } from './dto/create-admission.dto';

@Injectable()
export class AdmissionService {
  constructor(private prisma: PrismaService) { }

  async create(createAdmissionDto: CreateAdmissionDto) {
    return this.prisma.admission.create({
      data: {
        patientId: createAdmissionDto.patientId,
        admissionDate: new Date(createAdmissionDto.admissionDate),
        dischargeDate: createAdmissionDto.dischargeDate
          ? new Date(createAdmissionDto.dischargeDate)
          : null,
        ward: createAdmissionDto.ward,
        room: createAdmissionDto.room,
        reason: createAdmissionDto.reason,
        createdById: '',
      },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { admissionDate: 'desc' },
      }),
      this.prisma.admission.count(),
    ]);

    return { admissions, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.admission.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.admission.findMany({
      where: { patientId },
      orderBy: { admissionDate: 'desc' },
      include: {
        patient: true,
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
      },
    });
  }

  async remove(id: string) {
    return this.prisma.admission.delete({
      where: { id },
    });
  }
}
