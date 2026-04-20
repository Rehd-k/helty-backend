import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateHandoverReportDto } from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class HandoverReportService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.handoverReport.findMany({
      where: { admissionId },
      orderBy: { createdAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateHandoverReportDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.handoverReport.create({
      data: {
        admissionId,
        nurseId: staffId,
        shiftType: dto.shiftType,
        summary: dto.summary.trim(),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
