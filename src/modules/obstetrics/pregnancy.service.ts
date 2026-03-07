import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PregnancyStatus } from '@prisma/client';
import { CreatePregnancyDto, UpdatePregnancyDto } from './dto/create-pregnancy.dto';
import { ListPregnanciesQueryDto } from './dto/list-pregnancies-query.dto';

@Injectable()
export class PregnancyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePregnancyDto, createdById: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }

    return this.prisma.pregnancy.create({
      data: {
        patientId: dto.patientId,
        gravida: dto.gravida,
        para: dto.para,
        lmp: new Date(dto.lmp),
        edd: new Date(dto.edd),
        bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : null,
        status: dto.status ?? 'ONGOING',
        outcome: dto.outcome ?? null,
        createdById,
        updatedById: createdById,
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
      },
    });
  }

  async findAll(query: ListPregnanciesQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: { patientId?: string; status?: PregnancyStatus } = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status as PregnancyStatus;

    const [pregnancies, total] = await Promise.all([
      this.prisma.pregnancy.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, surname: true } },
        },
      }),
      this.prisma.pregnancy.count({ where }),
    ]);

    return { pregnancies, total, skip, take };
  }

  async findOne(id: string) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id },
      include: {
        patient: true,
        antenatalVisits: { orderBy: { visitDate: 'desc' }, take: 10 },
        labourDeliveries: true,
      },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${id}" not found.`);
    }
    return pregnancy;
  }

  async update(id: string, dto: UpdatePregnancyDto) {
    await this.findOne(id);
    return this.prisma.pregnancy.update({
      where: { id },
      data: {
        ...(dto.gravida !== undefined && { gravida: dto.gravida }),
        ...(dto.para !== undefined && { para: dto.para }),
        ...(dto.lmp !== undefined && { lmp: new Date(dto.lmp) }),
        ...(dto.edd !== undefined && { edd: new Date(dto.edd) }),
        ...(dto.bookingDate !== undefined && {
          bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
      },
    });
  }
}
