import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class PrescriptionService {
  constructor(private prisma: PrismaService) {}

  async create(createPrescriptionDto: CreatePrescriptionDto) {
    return this.prisma.prescription.create({
      data: {
        patientId: createPrescriptionDto.patientId,
        drug: createPrescriptionDto.drug,
        dosage: createPrescriptionDto.dosage,
        startDate: new Date(createPrescriptionDto.startDate),
        endDate: createPrescriptionDto.endDate
          ? new Date(createPrescriptionDto.endDate)
          : null,
        notes: createPrescriptionDto.notes,
      },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [prescriptions, total] = await Promise.all([
      this.prisma.prescription.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.prescription.count(),
    ]);

    return { prescriptions, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async getActivePrescriptions(patientId: string) {
    const today = new Date();
    return this.prisma.prescription.findMany({
      where: {
        patientId,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async update(id: string, updatePrescriptionDto: UpdatePrescriptionDto) {
    return this.prisma.prescription.update({
      where: { id },
      data: {
        ...updatePrescriptionDto,
        ...(updatePrescriptionDto.endDate && {
          endDate: new Date(updatePrescriptionDto.endDate),
        }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.prescription.delete({
      where: { id },
    });
  }
}
