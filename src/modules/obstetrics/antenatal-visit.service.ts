import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAntenatalVisitDto, UpdateAntenatalVisitDto } from './dto/create-antenatal-visit.dto';
import { ListAntenatalVisitsQueryDto } from './dto/list-antenatal-visits-query.dto';

@Injectable()
export class AntenatalVisitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAntenatalVisitDto) {
    const [pregnancy, staff] = await Promise.all([
      this.prisma.pregnancy.findUnique({ where: { id: dto.pregnancyId } }),
      this.prisma.staff.findUnique({ where: { id: dto.staffId } }),
    ]);
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${dto.pregnancyId}" not found.`);
    }
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.staffId}" not found.`);
    }
    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: dto.encounterId },
      });
      if (!encounter) {
        throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
      }
    }

    return this.prisma.antenatalVisit.create({
      data: {
        pregnancyId: dto.pregnancyId,
        visitDate: new Date(dto.visitDate),
        gestationWeeks: dto.gestationWeeks ?? null,
        systolicBP: dto.systolicBP ?? null,
        diastolicBP: dto.diastolicBP ?? null,
        weight: dto.weight ?? null,
        fundalHeight: dto.fundalHeight ?? null,
        fetalHeartRate: dto.fetalHeartRate ?? null,
        presentation: dto.presentation ?? null,
        urineProtein: dto.urineProtein ?? null,
        notes: dto.notes ?? null,
        ultrasoundFindings: dto.ultrasoundFindings ?? null,
        labResultsJson: dto.labResultsJson ?? Prisma.DbNull,
        staffId: dto.staffId,
        encounterId: dto.encounterId ?? null,
      },
      include: {
        pregnancy: { select: { id: true, patientId: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByPregnancy(pregnancyId: string, query: ListAntenatalVisitsQueryDto) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id: pregnancyId },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${pregnancyId}" not found.`);
    }

    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    const where: { pregnancyId: string; visitDate?: { gte?: Date; lte?: Date } } = {
      pregnancyId,
    };
    if (query.fromDate) {
      where.visitDate = { ...where.visitDate, gte: new Date(query.fromDate) };
    }
    if (query.toDate) {
      const to = new Date(query.toDate);
      to.setDate(to.getDate() + 1);
      where.visitDate = { ...where.visitDate, lte: to };
    }

    const [visits, total] = await Promise.all([
      this.prisma.antenatalVisit.findMany({
        where,
        skip,
        take,
        orderBy: { visitDate: 'desc' },
        include: {
          staff: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.antenatalVisit.count({ where }),
    ]);

    return { visits, total, skip, take };
  }

  async findOne(id: string) {
    const visit = await this.prisma.antenatalVisit.findUnique({
      where: { id },
      include: {
        pregnancy: { include: { patient: true } },
        staff: true,
        encounter: true,
      },
    });
    if (!visit) {
      throw new NotFoundException(`Antenatal visit "${id}" not found.`);
    }
    return visit;
  }

  async update(id: string, dto: UpdateAntenatalVisitDto) {
    await this.findOne(id);
    return this.prisma.antenatalVisit.update({
      where: { id },
      data: {
        ...(dto.visitDate !== undefined && { visitDate: new Date(dto.visitDate) }),
        ...(dto.gestationWeeks !== undefined && { gestationWeeks: dto.gestationWeeks }),
        ...(dto.systolicBP !== undefined && { systolicBP: dto.systolicBP }),
        ...(dto.diastolicBP !== undefined && { diastolicBP: dto.diastolicBP }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.fundalHeight !== undefined && { fundalHeight: dto.fundalHeight }),
        ...(dto.fetalHeartRate !== undefined && { fetalHeartRate: dto.fetalHeartRate }),
        ...(dto.presentation !== undefined && { presentation: dto.presentation }),
        ...(dto.urineProtein !== undefined && { urineProtein: dto.urineProtein }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.ultrasoundFindings !== undefined && { ultrasoundFindings: dto.ultrasoundFindings }),
        ...(dto.labResultsJson !== undefined && {
          labResultsJson: dto.labResultsJson === null ? Prisma.DbNull : (dto.labResultsJson as object),
        }),
        ...(dto.encounterId !== undefined && { encounterId: dto.encounterId ?? null }),
      },
      include: {
        pregnancy: { select: { id: true, patientId: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
