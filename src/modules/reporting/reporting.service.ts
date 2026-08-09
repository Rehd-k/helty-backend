import { Injectable } from '@nestjs/common';
import { AdmissionStatus, Prisma } from '@prisma/client';
import { parseDateRange } from '../../common/utils/date-range';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReportDateRangeQueryDto,
  RequestsByWardReportQueryDto,
  WardAdmissionsReportQueryDto,
} from './dto/reporting-query.dto';
import { ReportRow } from './reporting-export.util';

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async wardAdmissions(query: WardAdmissionsReportQueryDto) {
    const { from, to } = parseDateRange(query.from, query.to);
    const where: Prisma.AdmissionWhereInput = {
      admissionDateTime: { gte: from, lte: to },
    };
    if (query.wardId) {
      where.OR = [
        { wardId: query.wardId },
        { wardHistory: { some: { toWardId: query.wardId } } },
      ];
    }

    const admissions = await this.prisma.admission.findMany({
      where,
      orderBy: { admissionDateTime: 'asc' },
      include: {
        patient: { select: { ...patientNameFieldsSelect, patientId: true } },
        wardEntity: { select: { id: true, name: true } },
        wardHistory: {
          orderBy: { changedAt: 'asc' },
          include: {
            fromWard: { select: { id: true, name: true } },
            toWard: { select: { id: true, name: true } },
          },
        },
      },
    });

    const rows = admissions.map((a) => {
      const admitAt = a.admissionDateTime ?? a.admissionDate;
      const dischargeAt = a.dischargeDateTime ?? a.dischargeDate ?? null;
      const losDays = dischargeAt
        ? daysBetween(admitAt, dischargeAt)
        : daysBetween(admitAt, new Date());
      return {
        admissionId: a.id,
        patientId: a.patient.patientId,
        patientName: formatPatientDisplayName(a.patient),
        wardId: a.wardId,
        wardName: a.wardEntity?.name ?? a.ward ?? null,
        reason: a.admissionReason ?? a.reason ?? null,
        status: a.status,
        admitAt: admitAt.toISOString(),
        dischargeAt: dischargeAt?.toISOString() ?? null,
        lengthOfStayDays: losDays,
        wardHistory: a.wardHistory.map((h) => ({
          fromWardId: h.fromWardId,
          fromWardName: h.fromWard?.name ?? null,
          toWardId: h.toWardId,
          toWardName: h.toWard?.name ?? null,
          changedAt: h.changedAt.toISOString(),
          reason: h.reason,
        })),
      };
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      wardId: query.wardId ?? null,
      total: rows.length,
      data: rows,
    };
  }

  wardAdmissionsFlatRows(
    report: Awaited<ReturnType<ReportingService['wardAdmissions']>>,
  ): ReportRow[] {
    return report.data.map((row) => ({
      admissionId: row.admissionId,
      patientId: row.patientId,
      patientName: row.patientName,
      wardId: row.wardId,
      wardName: row.wardName,
      reason: row.reason,
      status: row.status,
      admitAt: row.admitAt,
      dischargeAt: row.dischargeAt,
      lengthOfStayDays: row.lengthOfStayDays,
      wardHistorySegments: row.wardHistory.length,
    }));
  }

  async requestsByWard(query: RequestsByWardReportQueryDto) {
    const { from, to } = parseDateRange(query.from, query.to);
    const createdAt = { gte: from, lte: to };

    type WardBucket = {
      wardId: string | null;
      wardName: string;
      count: number;
    };
    const buckets = new Map<string, WardBucket>();

    const bump = (wardId: string | null, wardName: string | null) => {
      const key = wardId ?? '__OPD__';
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, {
          wardId,
          wardName: wardId ? (wardName ?? 'Unknown ward') : 'OPD',
          count: 1,
        });
      }
    };

    if (query.type === 'lab') {
      const rows = await this.prisma.labRequest.findMany({
        where: { createdAt },
        select: {
          wardId: true,
          ward: { select: { name: true } },
        },
      });
      for (const row of rows) bump(row.wardId, row.ward?.name ?? null);
    } else if (query.type === 'radiology') {
      const rows = await this.prisma.radiologyOrder.findMany({
        where: { createdAt },
        select: {
          wardId: true,
          ward: { select: { name: true } },
        },
      });
      for (const row of rows) bump(row.wardId, row.ward?.name ?? null);
    } else {
      // Prescription has no createdAt — use startDate; medication requests use createdAt.
      const [prescriptions, medicationRequests] = await Promise.all([
        this.prisma.prescription.findMany({
          where: { startDate: createdAt },
          select: {
            wardId: true,
            ward: { select: { name: true } },
          },
        }),
        this.prisma.medicationRequest.findMany({
          where: { createdAt },
          select: {
            wardId: true,
            ward: { select: { name: true } },
          },
        }),
      ]);
      for (const row of prescriptions) bump(row.wardId, row.ward?.name ?? null);
      for (const row of medicationRequests)
        bump(row.wardId, row.ward?.name ?? null);
    }

    const data = [...buckets.values()].sort((a, b) => b.count - a.count);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      type: query.type,
      total: data.reduce((sum, r) => sum + r.count, 0),
      data,
    };
  }

  requestsByWardFlatRows(
    report: Awaited<ReturnType<ReportingService['requestsByWard']>>,
  ): ReportRow[] {
    return report.data.map((row) => ({
      wardId: row.wardId,
      wardName: row.wardName,
      count: row.count,
      type: report.type,
    }));
  }

  async dischargeHistory(query: ReportDateRangeQueryDto) {
    const { from, to } = parseDateRange(query.from, query.to);
    const admissions = await this.prisma.admission.findMany({
      where: {
        status: {
          in: [AdmissionStatus.DISCHARGED, AdmissionStatus.DECEASED],
        },
        billingClearedAt: { not: null },
        nursesClearedAt: { not: null },
        OR: [
          { dischargeDateTime: { gte: from, lte: to } },
          {
            dischargeDateTime: null,
            dischargeDate: { gte: from, lte: to },
          },
        ],
      },
      orderBy: { dischargeDateTime: 'desc' },
      include: {
        patient: { select: { ...patientNameFieldsSelect, patientId: true } },
        wardEntity: { select: { id: true, name: true } },
        encounter: { select: { id: true } },
      },
    });

    const rows = await Promise.all(
      admissions.map(async (a) => {
        const invoiceWhere: Prisma.InvoiceWhereInput = {
          patientId: a.patientId,
          OR: [
            { encounter: { admissionId: a.id } },
            ...(a.encounter?.id ? [{ encounterId: a.encounter.id }] : []),
          ],
        };
        const invoices = await this.prisma.invoice.findMany({
          where: invoiceWhere,
          select: { id: true, invoiceID: true, status: true },
        });
        const dischargeAt = a.dischargeDateTime ?? a.dischargeDate ?? null;
        return {
          admissionId: a.id,
          patientId: a.patient.patientId,
          patientName: formatPatientDisplayName(a.patient),
          status: a.status,
          outcome: a.outcome,
          wardId: a.wardId,
          wardName: a.wardEntity?.name ?? a.ward ?? null,
          admitAt: (a.admissionDateTime ?? a.admissionDate).toISOString(),
          dischargeAt: dischargeAt?.toISOString() ?? null,
          billingClearedAt: a.billingClearedAt?.toISOString() ?? null,
          nursesClearedAt: a.nursesClearedAt?.toISOString() ?? null,
          invoiceIds: invoices.map((i) => i.id),
          invoiceNumbers: invoices.map((i) => i.invoiceID),
        };
      }),
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total: rows.length,
      data: rows,
    };
  }

  dischargeHistoryFlatRows(
    report: Awaited<ReturnType<ReportingService['dischargeHistory']>>,
  ): ReportRow[] {
    return report.data.map((row) => ({
      admissionId: row.admissionId,
      patientId: row.patientId,
      patientName: row.patientName,
      status: row.status,
      outcome: row.outcome,
      wardId: row.wardId,
      wardName: row.wardName,
      admitAt: row.admitAt,
      dischargeAt: row.dischargeAt,
      billingClearedAt: row.billingClearedAt,
      nursesClearedAt: row.nursesClearedAt,
      invoiceIds: row.invoiceIds.join(';'),
      invoiceNumbers: row.invoiceNumbers.join(';'),
    }));
  }

  async medicalRecordsAttendance(query: ReportDateRangeQueryDto) {
    const { from, to } = parseDateRange(query.from, query.to);
    const encounters = await this.prisma.encounter.findMany({
      where: { startTime: { gte: from, lte: to } },
      orderBy: { startTime: 'asc' },
      include: {
        patient: { select: { ...patientNameFieldsSelect, patientId: true } },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
        diagnoses: {
          select: {
            primaryIcdCode: true,
            primaryIcdDescription: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        labRequests: {
          select: { id: true, testType: true, status: true },
        },
        radiologyOrders: {
          select: { id: true, status: true },
        },
      },
    });

    const data = encounters.map((e) => ({
      encounterId: e.id,
      patientId: e.patient.patientId,
      patientName: formatPatientDisplayName(e.patient),
      doctorId: e.doctor.id,
      doctorName: `${e.doctor.firstName} ${e.doctor.lastName}`.trim(),
      doctorStaffId: e.doctor.staffId,
      encounterType: e.encounterType,
      startTime: e.startTime.toISOString(),
      diagnosis:
        e.primaryIcdDescription ??
        e.diagnoses[0]?.primaryIcdDescription ??
        null,
      diagnosisCode:
        e.primaryIcdCode ?? e.diagnoses[0]?.primaryIcdCode ?? null,
      diagnoses: e.diagnoses,
      labRequestCount: e.labRequests.length,
      labRequests: e.labRequests,
      radiologyOrderCount: e.radiologyOrders.length,
      radiologyOrders: e.radiologyOrders,
    }));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total: data.length,
      data,
    };
  }

  medicalRecordsAttendanceFlatRows(
    report: Awaited<ReturnType<ReportingService['medicalRecordsAttendance']>>,
  ): ReportRow[] {
    return report.data.map((row) => ({
      encounterId: row.encounterId,
      patientId: row.patientId,
      patientName: row.patientName,
      doctorName: row.doctorName,
      doctorStaffId: row.doctorStaffId,
      encounterType: row.encounterType,
      startTime: row.startTime,
      diagnosis: row.diagnosis,
      diagnosisCode: row.diagnosisCode,
      labRequestCount: row.labRequestCount,
      radiologyOrderCount: row.radiologyOrderCount,
    }));
  }

  async medicalRecordsAdmissions(query: ReportDateRangeQueryDto) {
    const { from, to } = parseDateRange(query.from, query.to);
    const admissions = await this.prisma.admission.findMany({
      where: { admissionDateTime: { gte: from, lte: to } },
      select: {
        wardId: true,
        wardEntity: { select: { name: true } },
        ward: true,
        admissionReason: true,
        reason: true,
      },
    });

    const byReason = new Map<string, number>();
    const byWard = new Map<
      string,
      { wardId: string | null; wardName: string; count: number }
    >();

    for (const a of admissions) {
      const reason = (a.admissionReason ?? a.reason ?? 'Unspecified').trim();
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);

      const wardKey = a.wardId ?? '__NONE__';
      const wardName = a.wardEntity?.name ?? a.ward ?? 'Unassigned';
      const existing = byWard.get(wardKey);
      if (existing) existing.count += 1;
      else
        byWard.set(wardKey, {
          wardId: a.wardId,
          wardName,
          count: 1,
        });
    }

    const byReasonRows = [...byReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    const byWardRows = [...byWard.values()].sort((a, b) => b.count - a.count);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      total: admissions.length,
      byReason: byReasonRows,
      byWard: byWardRows,
    };
  }

  medicalRecordsAdmissionsFlatRows(
    report: Awaited<ReturnType<ReportingService['medicalRecordsAdmissions']>>,
  ): ReportRow[] {
    const reasonRows = report.byReason.map((r) => ({
      dimension: 'reason',
      key: r.reason,
      label: r.reason,
      count: r.count,
    }));
    const wardRows = report.byWard.map((r) => ({
      dimension: 'ward',
      key: r.wardId ?? '',
      label: r.wardName,
      count: r.count,
    }));
    return [...reasonRows, ...wardRows];
  }
}
