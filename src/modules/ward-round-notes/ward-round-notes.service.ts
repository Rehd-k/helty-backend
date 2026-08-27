import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WardRoundNote } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWardRoundNoteDto,
  hasAtLeastOneSoapField,
} from './dto/create-ward-round-note.dto';
import { UpdateWardRoundNoteDto } from './dto/update-ward-round-note.dto';
import { ListWardRoundNotesQueryDto } from './dto/list-ward-round-notes-query.dto';

function formatRoundDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toWardRoundNoteResponse(note: WardRoundNote) {
  return {
    id: note.id,
    admissionId: note.admissionId,
    doctorId: note.doctorId,
    roundDate: formatRoundDate(note.roundDate),
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

@Injectable()
export class WardRoundNotesService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateWardRoundNoteDto, actorStaffId: string) {
    if (!hasAtLeastOneSoapField(dto)) {
      throw new BadRequestException(
        'At least one of subjective, objective, assessment, or plan must be non-empty.',
      );
    }

    const doctorId = actorStaffId;
    const [admission, doctor] = await Promise.all([
      this.prisma.admission.findUnique({ where: { id: dto.admissionId } }),
      this.prisma.staff.findUnique({ where: { id: doctorId } }),
    ]);

    if (!admission) {
      throw new NotFoundException(`Admission "${dto.admissionId}" not found.`);
    }
    if (!doctor) {
      throw new NotFoundException(`Staff/doctor "${doctorId}" not found.`);
    }

    const roundDate = new Date(dto.roundDate);
    roundDate.setUTCHours(0, 0, 0, 0);

    const note = await this.prisma.wardRoundNote.create({
      data: {
        admissionId: dto.admissionId,
        doctorId,
        roundDate,
        subjective: dto.subjective?.trim() || null,
        objective: dto.objective?.trim() || null,
        assessment: dto.assessment?.trim() || null,
        plan: dto.plan?.trim() || null,
      },
    });
    return toWardRoundNoteResponse(note);
  }

  async update(id: string, dto: UpdateWardRoundNoteDto, actorStaffId: string) {
    const existing = await this.prisma.wardRoundNote.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Ward round note "${id}" not found.`);
    }
    if (existing.doctorId !== actorStaffId) {
      throw new ForbiddenException(
        'Only the doctor who recorded this ward round note can edit it.',
      );
    }

    const merged = {
      subjective:
        dto.subjective !== undefined
          ? dto.subjective.trim() || null
          : existing.subjective,
      objective:
        dto.objective !== undefined
          ? dto.objective.trim() || null
          : existing.objective,
      assessment:
        dto.assessment !== undefined
          ? dto.assessment.trim() || null
          : existing.assessment,
      plan:
        dto.plan !== undefined ? dto.plan.trim() || null : existing.plan,
    };

    if (!hasAtLeastOneSoapField(merged)) {
      throw new BadRequestException(
        'At least one of subjective, objective, assessment, or plan must be non-empty.',
      );
    }

    const data: {
      roundDate?: Date;
      subjective: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
    } = { ...merged };

    if (dto.roundDate !== undefined) {
      const roundDate = new Date(dto.roundDate);
      roundDate.setUTCHours(0, 0, 0, 0);
      data.roundDate = roundDate;
    }

    const note = await this.prisma.wardRoundNote.update({
      where: { id },
      data,
    });
    return toWardRoundNoteResponse(note);
  }

  async findAll(query: ListWardRoundNotesQueryDto) {
    const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
    const toDate = query.toDate ? new Date(query.toDate) : undefined;

    if (fromDate) fromDate.setUTCHours(0, 0, 0, 0);
    if (toDate) {
      toDate.setUTCHours(0, 0, 0, 0);
      toDate.setDate(toDate.getDate() + 1);
    }

    const where: any = {
      admissionId: query.admissionId,
      ...(query.doctorId && { doctorId: query.doctorId }),
      ...(fromDate && { roundDate: { gte: fromDate } }),
      ...(toDate && { roundDate: { lt: toDate } }),
    };

    const notes = await this.prisma.wardRoundNote.findMany({
      where,
      include: {
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            accountType: true,
          },
        },
      },
      orderBy: { roundDate: 'desc' },
    });
    return notes;
  }
}
