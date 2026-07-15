import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import {
  CreateNursingNoteDto,
  UpdateNursingNoteDto,
} from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class NursingNoteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.nursingNote.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateNursingNoteDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.nursingNote.create({
      data: {
        admissionId,
        nurseId: staffId,
        noteType: dto.noteType,
        content: dto.content.trim(),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async update(
    admissionId: string,
    noteId: string,
    dto: UpdateNursingNoteDto,
    staffId: string,
  ) {
    await assertStaffIsNurseOrThrow(this.prisma, staffId);
    const row = await this.prisma.nursingNote.findFirst({
      where: { id: noteId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Nursing note not found.');
    }
    if (row.nurseId !== staffId) {
      throw new NotFoundException('Nursing note not found.');
    }

    return this.prisma.nursingNote.update({
      where: { id: noteId },
      data: {
        ...(dto.noteType !== undefined && { noteType: dto.noteType }),
        ...(dto.content !== undefined && { content: dto.content.trim() }),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
