import { Injectable, NotFoundException } from '@nestjs/common';
import { AdmissionAlertType, AlertSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdmissionExists } from './inpatient-nursing.utils';
import { CreateAlertLogDto, ResolveAlertLogDto } from './dto/alert-log.dto';

const ALERT_TITLES: Record<AdmissionAlertType, string | null> = {
  [AdmissionAlertType.GENERIC]: null,
  [AdmissionAlertType.MEDICATION_DOSE_DUE]: 'Medication dose due',
  [AdmissionAlertType.MEDICATION_DOSE_OVERDUE]: 'Medication dose overdue',
  [AdmissionAlertType.MEDICATION_COURSE_EXPIRED]: 'Medication course expired',
};

function severityApi(severity: AlertSeverity): string {
  return severity.toLowerCase();
}

@Injectable()
export class AlertLogService {
  constructor(private readonly prisma: PrismaService) {}

  private mapAlert(row: {
    id: string;
    admissionId: string;
    alertType: string;
    type: AdmissionAlertType;
    severity: AlertSeverity;
    message: string;
    medicationOrderId: string | null;
    dueAt: Date | null;
    metadata: unknown;
    resolved: boolean;
    resolvedAt: Date | null;
    createdAt: Date;
    resolvedBy: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }) {
    const title = ALERT_TITLES[row.type] ?? row.alertType;
    return {
      id: row.id,
      admissionId: row.admissionId,
      alertType: row.alertType,
      type: row.type,
      severity: severityApi(row.severity),
      title,
      message: row.message,
      medicationOrderId: row.medicationOrderId,
      dueAt: row.dueAt?.toISOString() ?? null,
      metadata: row.metadata ?? null,
      resolved: row.resolved,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      resolvedBy: row.resolvedBy,
    };
  }

  async list(admissionId: string, unresolvedOnly?: boolean) {
    await assertAdmissionExists(this.prisma, admissionId);
    const rows = await this.prisma.alertLog.findMany({
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
    return rows.map((row) => this.mapAlert(row));
  }

  async create(admissionId: string, dto: CreateAlertLogDto) {
    await assertAdmissionExists(this.prisma, admissionId);
    const row = await this.prisma.alertLog.create({
      data: {
        admissionId,
        alertType: dto.alertType.trim(),
        type: AdmissionAlertType.GENERIC,
        severity: dto.severity,
        message: dto.message.trim(),
      },
      include: {
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return this.mapAlert(row);
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
    }).then((row) => this.mapAlert(row));
  }
}
