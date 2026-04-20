import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import {
  CreateMonitoringChartDto,
  UpdateMonitoringChartDto,
} from './dto/nursing-docs.dto';

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class MonitoringChartService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.monitoringChart.findMany({
      where: { admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateMonitoringChartDto,
    staffId: string,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    return this.prisma.monitoringChart.create({
      data: {
        admissionId,
        nurseId: staffId,
        type: dto.type,
        value: dto.value as Prisma.InputJsonValue,
        recordedAt: new Date(dto.recordedAt),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async update(
    admissionId: string,
    chartId: string,
    dto: UpdateMonitoringChartDto,
    staffId: string,
  ) {
    await assertStaffIsNurseOrThrow(this.prisma, staffId);
    const row = await this.prisma.monitoringChart.findFirst({
      where: { id: chartId, admissionId },
    });
    if (!row) {
      throw new NotFoundException('Monitoring chart entry not found.');
    }
    if (row.nurseId !== staffId) {
      throw new NotFoundException('Monitoring chart entry not found.');
    }

    return this.prisma.monitoringChart.update({
      where: { id: chartId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && {
          value: dto.value as Prisma.InputJsonValue,
        }),
        ...(dto.recordedAt !== undefined && {
          recordedAt: new Date(dto.recordedAt),
        }),
      },
      include: { nurse: { select: nurseSelect } },
    });
  }
}
