import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RadiologyModality } from '@prisma/client';

@Injectable()
export class RadiologyMachineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeOnly?: boolean) {
    const where = activeOnly !== false ? { isActive: true } : {};
    return this.prisma.radiologyMachine.findMany({
      where,
      orderBy: [{ modality: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const machine = await this.prisma.radiologyMachine.findUnique({
      where: { id },
    });
    if (!machine) {
      throw new NotFoundException(`Radiology machine "${id}" not found.`);
    }
    return machine;
  }

  async findByModality(modality: RadiologyModality) {
    return this.prisma.radiologyMachine.findMany({
      where: { modality, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
