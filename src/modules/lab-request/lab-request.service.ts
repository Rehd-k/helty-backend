import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLabRequestDto, UpdateLabRequestDto } from './dto/create-lab-request.dto';

@Injectable()
export class LabRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabRequestDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException('Patient does not match the encounter.');
    }
    return this.prisma.labRequest.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        requestedByDoctorId: dto.requestedByDoctorId,
        testType: dto.testType,
        notes: dto.notes,
      },
      include: {
        encounter: { select: { id: true, encounterType: true, status: true } },
        patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, staffId: true } },
      },
    });
  }

  async findAll(skip = 0, take = 20, encounterId?: string, patientId?: string) {
    const where: { encounterId?: string; patientId?: string } = {};
    if (encounterId) where.encounterId = encounterId;
    if (patientId) where.patientId = patientId;

    const [data, total] = await Promise.all([
      this.prisma.labRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          encounter: { select: { id: true, encounterType: true, status: true } },
          patient: { select: { id: true, firstName: true, surname: true, patientId: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.labRequest.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.labRequest.findUnique({
      where: { id },
      include: {
        encounter: true,
        patient: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, staffId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }
    return request;
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.labRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateLabRequestDto) {
    await this.findOne(id);
    return this.prisma.labRequest.update({
      where: { id },
      data: dto,
      include: {
        encounter: { select: { id: true, status: true } },
        patient: { select: { id: true, firstName: true, surname: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.labRequest.delete({ where: { id } });
    return { message: 'Lab request removed successfully.' };
  }
}
