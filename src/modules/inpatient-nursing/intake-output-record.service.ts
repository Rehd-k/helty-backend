import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import {
  CreateIntakeOutputRecordDto,
  UpdateIntakeOutputRecordDto,
} from './dto/intake-output.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class IntakeOutputRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.intakeOutputRecord.findMany({
      where: { admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateIntakeOutputRecordDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.intakeOutputRecord.create({
      data: {
        admissionId,
        nurseId: staffId,
        type: dto.type,
        category: dto.category,
        amountMl: dto.amountMl,
        recordedAt: new Date(dto.recordedAt),
        notes: dto.notes?.trim() || null,
      },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async update(
    admissionId: string,
    recordId: string,
    dto: UpdateIntakeOutputRecordDto,
    staffId: string,
  ) {
    await assertStaffIsNurseOrThrow(this.prisma, staffId);
    const row = await this.prisma.intakeOutputRecord.findFirst({
      where: { id: recordId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Intake/output record not found.');
    }
    if (row.nurseId !== staffId) {
      throw new NotFoundException('Intake/output record not found.');
    }

    return this.prisma.intakeOutputRecord.update({
      where: { id: recordId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.amountMl !== undefined && { amountMl: dto.amountMl }),
        ...(dto.recordedAt !== undefined && {
          recordedAt: new Date(dto.recordedAt),
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
