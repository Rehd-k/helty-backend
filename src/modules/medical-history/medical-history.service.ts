import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicalHistoryDto, UpdateMedicalHistoryDto } from './dto/create-medical-history.dto';

@Injectable()
export class MedicalHistoryService {
  constructor(private prisma: PrismaService) { }

  async create(createMedicalHistoryDto: CreateMedicalHistoryDto) {
    return this.prisma.medicalHistory.create({
      data: { ...createMedicalHistoryDto, createdById: '', },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [histories, total] = await Promise.all([
      this.prisma.medicalHistory.findMany({
        skip,
        take,
        include: {
          patient: true,
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
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.medicalHistory.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async update(id: string, updateMedicalHistoryDto: UpdateMedicalHistoryDto) {
    return this.prisma.medicalHistory.update({
      where: { id },
      data: updateMedicalHistoryDto,
    });
  }

  async remove(id: string) {
    return this.prisma.medicalHistory.delete({
      where: { id },
    });
  }
}
