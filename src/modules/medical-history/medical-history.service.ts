import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMedicalHistoryDto,
  UpdateMedicalHistoryDto,
} from './dto/create-medical-history.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class MedicalHistoryService {
  constructor(private prisma: PrismaService) {}

  async create(
    createMedicalHistoryDto: CreateMedicalHistoryDto,
    staffId: string,
  ) {
    return this.prisma.medicalHistory.create({
      data: { ...createMedicalHistoryDto, createdById: staffId },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [histories, total] = await Promise.all([
      this.prisma.medicalHistory.findMany({
        skip,
        take,
        include: {
          patient: true,
          createdBy: { select: staffBriefSelect },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.medicalHistory.count(),
    ]);

    return { histories, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.medicalHistory.findUnique({
      where: { id },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.medicalHistory.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        createdBy: { select: staffBriefSelect },
      },
    });
  }

  async update(
    id: string,
    updateMedicalHistoryDto: UpdateMedicalHistoryDto,
    staffId: string,
  ) {
    return this.prisma.medicalHistory.update({
      where: { id },
      data: {
        ...updateMedicalHistoryDto,
        updatedById: staffId,
      },
      include: {
        patient: true,
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.medicalHistory.delete({
      where: { id },
    });
  }
}
