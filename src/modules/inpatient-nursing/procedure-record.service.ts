import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateProcedureRecordDto } from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class ProcedureRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.procedureRecord.findMany({
      where: { admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateProcedureRecordDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.procedureRecord.create({
      data: {
        admissionId,
        nurseId: staffId,
        procedureType: dto.procedureType.trim(),
        description: dto.description.trim(),
        outcome: dto.outcome?.trim() || null,
        complications: dto.complications?.trim() || null,
        recordedAt: new Date(dto.recordedAt),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
