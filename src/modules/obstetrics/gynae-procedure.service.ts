import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGynaeProcedureDto, UpdateGynaeProcedureDto } from './dto/create-gynae-procedure.dto';
import { ListGynaeProceduresQueryDto } from './dto/list-gynae-procedures-query.dto';

@Injectable()
export class GynaeProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGynaeProcedureDto) {
    const [patient, surgeon] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: dto.patientId } }),
      this.prisma.staff.findUnique({ where: { id: dto.surgeonId } }),
    ]);
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    if (!surgeon) {
      throw new NotFoundException(`Surgeon "${dto.surgeonId}" not found.`);
    }
    if (dto.encounterId) {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: dto.encounterId },
      });
      if (!encounter) throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (dto.admissionId) {
      const admission = await this.prisma.admission.findUnique({
        where: { id: dto.admissionId },
      });
      if (!admission) throw new NotFoundException(`Admission "${dto.admissionId}" not found.`);
    }
    if (dto.assistantId) {
      const assistant = await this.prisma.staff.findUnique({
        where: { id: dto.assistantId },
      });
      if (!assistant) throw new NotFoundException(`Assistant "${dto.assistantId}" not found.`);
    }

    return this.prisma.gynaeProcedure.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId ?? null,
        admissionId: dto.admissionId ?? null,
        procedureType: dto.procedureType,
        procedureDate: new Date(dto.procedureDate),
        surgeonId: dto.surgeonId,
        assistantId: dto.assistantId ?? null,
        findings: dto.findings ?? null,
        complications: dto.complications ?? null,
        notes: dto.notes ?? null,
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        surgeon: { select: { id: true, firstName: true, lastName: true } },
        assistant: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: ListGynaeProceduresQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: {
      patientId?: string;
      procedureType?: string;
      procedureDate?: { gte?: Date; lte?: Date };
    } = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.procedureType) where.procedureType = query.procedureType;
    if (query.fromDate) where.procedureDate = { ...where.procedureDate, gte: new Date(query.fromDate) };
    if (query.toDate) {
      const to = new Date(query.toDate);
      to.setDate(to.getDate() + 1);
      where.procedureDate = { ...where.procedureDate, lte: to };
    }

    const [procedures, total] = await Promise.all([
      this.prisma.gynaeProcedure.findMany({
        where,
        skip,
        take,
        orderBy: { procedureDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, surname: true } },
          surgeon: { select: { id: true, firstName: true, lastName: true } },
          assistant: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.gynaeProcedure.count({ where }),
    ]);

    return { procedures, total, skip, take };
  }

  async findOne(id: string) {
    const procedure = await this.prisma.gynaeProcedure.findUnique({
      where: { id },
      include: {
        patient: true,
        encounter: true,
        admission: true,
        surgeon: true,
        assistant: true,
      },
    });
    if (!procedure) {
      throw new NotFoundException(`Gynae procedure "${id}" not found.`);
    }
    return procedure;
  }

  async update(id: string, dto: UpdateGynaeProcedureDto) {
    await this.findOne(id);
    if (dto.surgeonId) {
      const surgeon = await this.prisma.staff.findUnique({ where: { id: dto.surgeonId } });
      if (!surgeon) throw new NotFoundException(`Surgeon "${dto.surgeonId}" not found.`);
    }
    if (dto.assistantId) {
      const assistant = await this.prisma.staff.findUnique({ where: { id: dto.assistantId } });
      if (!assistant) throw new NotFoundException(`Assistant "${dto.assistantId}" not found.`);
    }

    return this.prisma.gynaeProcedure.update({
      where: { id },
      data: {
        ...(dto.procedureDate !== undefined && { procedureDate: new Date(dto.procedureDate) }),
        ...(dto.procedureType !== undefined && { procedureType: dto.procedureType }),
        ...(dto.surgeonId !== undefined && { surgeonId: dto.surgeonId }),
        ...(dto.assistantId !== undefined && { assistantId: dto.assistantId ?? null }),
        ...(dto.findings !== undefined && { findings: dto.findings }),
        ...(dto.complications !== undefined && { complications: dto.complications }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        surgeon: { select: { id: true, firstName: true, lastName: true } },
        assistant: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
