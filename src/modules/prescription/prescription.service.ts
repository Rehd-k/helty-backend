import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto/create-prescription.dto';

@Injectable()
export class PrescriptionService {
  constructor(private prisma: PrismaService) { }

  async create(createPrescriptionDto: CreatePrescriptionDto) {
    if (createPrescriptionDto.encounterId) {
      await this.validateEncounterForPatient(
        createPrescriptionDto.encounterId,
        createPrescriptionDto.patientId,
      );
    }
    const { encounterId, ...rest } = createPrescriptionDto;
    return this.prisma.prescription.create({
      data: {
        ...rest,
        ...(encounterId && { encounterId }),
        ...(rest.startDate && { startDate: new Date(rest.startDate) }),
        ...(rest.endDate && { endDate: new Date(rest.endDate) }),
        createdById: '',
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
    const existing = await this.prisma.prescription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Prescription "${id}" not found.`);
    }
    if (updatePrescriptionDto.encounterId !== undefined) {
      await this.validateEncounterForPatient(
        updatePrescriptionDto.encounterId,
        existing.patientId,
      );
    }
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

  async findByEncounterId(encounterId: string) {
    return this.prisma.prescription.findMany({
      where: { encounterId },
      orderBy: { startDate: 'desc' },
      include: { patient: true, encounter: true },
    });
  }

  private async validateEncounterForPatient(encounterId: string, patientId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });
    if (!encounter) {
      throw new BadRequestException(`Encounter "${encounterId}" not found.`);
    }
    if (encounter.patientId !== patientId) {
      throw new BadRequestException('Encounter does not belong to the given patient.');
    }
  }

  async remove(id: string) {
    return this.prisma.prescription.delete({
      where: { id },
    });
  }
}
