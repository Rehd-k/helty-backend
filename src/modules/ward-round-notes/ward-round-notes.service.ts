import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WardRoundNote } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWardRoundNoteDto,
  hasAtLeastOneSoapField,
} from './dto/create-ward-round-note.dto';
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
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWardRoundNoteDto) {
    if (!hasAtLeastOneSoapField(dto)) {
      throw new BadRequestException(
        'At least one of subjective, objective, assessment, or plan must be non-empty.',
      );
    }

    const [admission, doctor] = await Promise.all([
      this.prisma.admission.findUnique({ where: { id: dto.admissionId } }),
      this.prisma.staff.findUnique({ where: { id: dto.doctorId } }),
    ]);

    if (!admission) {
      throw new NotFoundException(`Admission "${dto.admissionId}" not found.`);
    }
    if (!doctor) {
      throw new NotFoundException(`Staff/doctor "${dto.doctorId}" not found.`);
    }

    const roundDate = new Date(dto.roundDate);
    roundDate.setUTCHours(0, 0, 0, 0);

    const note = await this.prisma.wardRoundNote.create({
      data: {
        admissionId: dto.admissionId,
        doctorId: dto.doctorId,
        roundDate,
        subjective: dto.subjective?.trim() || null,
        objective: dto.objective?.trim() || null,
        assessment: dto.assessment?.trim() || null,
        plan: dto.plan?.trim() || null,
      },
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
      orderBy: { roundDate: 'desc' },
    });
    return notes.map(toWardRoundNoteResponse);
  }
}
