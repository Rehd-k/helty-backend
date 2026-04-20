import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateCarePlanDto, UpdateCarePlanDto } from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class CarePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.carePlan.findMany({
      where: { admissionId },
      orderBy: { updatedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateCarePlanDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.carePlan.create({
      data: {
        admissionId,
        nurseId: staffId,
        problem: dto.problem.trim(),
        goal: dto.goal.trim(),
        intervention: dto.intervention.trim(),
        evaluationStatus: dto.evaluationStatus.trim(),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async update(
    admissionId: string,
    carePlanId: string,
    dto: UpdateCarePlanDto,
    staffId: string,
  ) {
    await assertStaffIsNurseOrThrow(this.prisma, staffId);
    const row = await this.prisma.carePlan.findFirst({
      where: { id: carePlanId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Care plan not found.');
    }
    if (row.nurseId !== staffId) {
      throw new NotFoundException('Care plan not found.');
    }

    return this.prisma.carePlan.update({
      where: { id: carePlanId },
      data: {
        ...(dto.problem !== undefined && { problem: dto.problem }),
        ...(dto.goal !== undefined && { goal: dto.goal }),
        ...(dto.intervention !== undefined && { intervention: dto.intervention }),
        ...(dto.evaluationStatus !== undefined && {
          evaluationStatus: dto.evaluationStatus,
        }),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
