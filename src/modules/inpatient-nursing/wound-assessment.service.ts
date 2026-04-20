import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateWoundAssessmentDto } from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class WoundAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.woundAssessment.findMany({
      where: { admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateWoundAssessmentDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.woundAssessment.create({
      data: {
        admissionId,
        nurseId: staffId,
        woundLocation: dto.woundLocation.trim(),
        woundSize: dto.woundSize.trim(),
        woundStage: dto.woundStage.trim(),
        exudate: dto.exudate.trim(),
        odor: dto.odor.trim(),
        infectionSigns: dto.infectionSigns.trim(),
        photoUrl: dto.photoUrl?.trim() || null,
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
