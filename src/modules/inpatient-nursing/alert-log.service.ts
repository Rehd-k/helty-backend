import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdmissionExists } from './inpatient-nursing.utils';
import { CreateAlertLogDto, ResolveAlertLogDto } from './dto/alert-log.dto';

@Injectable()
export class AlertLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(admissionId: string, unresolvedOnly?: boolean) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.alertLog.findMany({
      where: {
        admissionId,
        ...(unresolvedOnly ? { resolved: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(admissionId: string, dto: CreateAlertLogDto) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.alertLog.create({
      data: {
        admissionId,
        alertType: dto.alertType.trim(),
        severity: dto.severity,
        message: dto.message.trim(),
      },
      include: {
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async resolve(
    admissionId: string,
    alertId: string,
    dto: ResolveAlertLogDto,
    resolverStaffId: string,
  ) {
    const alert = await this.prisma.alertLog.findFirst({
      where: { id: alertId, admissionId },
    });
    if (!alert) {
      throw new NotFoundException('Alert not found.');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: resolverStaffId },
    });
    if (!staff) {
      throw new NotFoundException('Resolver staff not found.');
    }

    return this.prisma.alertLog.update({
      where: { id: alertId },
      data: {
        resolved: dto.resolved ?? true,
        resolvedById: resolverStaffId,
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : new Date(),
      },
      include: {
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
