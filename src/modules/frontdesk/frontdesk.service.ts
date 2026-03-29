import { Injectable } from '@nestjs/common';
import {
  AdmissionStatus,
  EncounterStatus,
  EncounterType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { compareMetrics } from '../billing-analytics/billing-analytics-math';
import { startOfDay, endOfDay } from '../../common/utils/date-range';

/** Matches seed / REF_Categories: Consultations & Reviews */
export const CONSULTATIONS_REVIEWS_CATEGORY = 'Consultations & Reviews';

export type FrontdeskQueueStatus = 'Waiting' | 'InRoom' | 'InConsultation';

export interface FrontdeskQueueRow {
  /** Stable key for lists: `wp:<uuid>` or `en:<uuid>` */
  id: string;
  patientId: string;
  patientName: string;
  time: string;
  doctor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  status: FrontdeskQueueStatus;
  assignedRoom: { id: string; name: string } | null;
  waitingPatientId: string | null;
  encounterId: string | null;
}

@Injectable()
export class FrontdeskService {
  private readonly dayMs = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private anchor(asOf?: string): Date {
    if (!asOf) return new Date();
    const d = new Date(asOf);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  private dayWindow(d: Date): { from: Date; to: Date } {
    return { from: startOfDay(d), to: endOfDay(d) };
  }

  private asDecimal(
    v: Prisma.Decimal | number | null | undefined,
  ): Prisma.Decimal {
    if (v === null || v === undefined) return new Prisma.Decimal(0);
    if (v instanceof Prisma.Decimal) return v;
    return new Prisma.Decimal(v);
  }

  private computeRecurringDays(
    segments: Array<{ startAt: Date; endAt: Date | null }>,
    now: Date,
  ): number {
    let totalDays = 0;
    for (const segment of segments) {
      const endAt = segment.endAt ?? now;
      const duration = endAt.getTime() - segment.startAt.getTime();
      if (duration <= 0) continue;
      const isOpen = segment.endAt === null;
      const days = isOpen
        ? Math.floor(duration / this.dayMs)
        : Math.ceil(duration / this.dayMs);
      totalDays += days;
    }
    return totalDays;
  }

  private invoiceLineTotal(
    item: {
      unitPrice: Prisma.Decimal;
      quantity: number;
      isRecurringDaily: boolean;
      usageSegments: Array<{ startAt: Date; endAt: Date | null }>;
    },
    now: Date,
  ): Prisma.Decimal {
    const unitPrice = this.asDecimal(item.unitPrice);
    if (item.isRecurringDaily) {
      const totalDays = this.computeRecurringDays(item.usageSegments, now);
      return unitPrice.mul(totalDays);
    }
    return unitPrice.mul(item.quantity);
  }

  /**
   * Distinct patients with a fully paid invoice line for Consultations & Reviews on an invoice
   * created today (anchor day), excluding patients with an ongoing outpatient encounter.
   */
  async waitingRoomCount(anchorDate: Date): Promise<number> {
    const { from, to } = this.dayWindow(anchorDate);

    const items = await this.prisma.invoiceItem.findMany({
      where: {
        service: {
          category: { name: CONSULTATIONS_REVIEWS_CATEGORY },
        },
        invoice: {
          createdAt: { gte: from, lte: to },
        },
      },
      include: {
        invoice: { select: { patientId: true } },
        usageSegments: { orderBy: { startAt: 'asc' } },
      },
    });

    const now = anchorDate;
    const paidPatientIds = new Set<string>();
    for (const item of items) {
      const lineTotal = this.invoiceLineTotal(item, now);
      const paid = this.asDecimal(item.amountPaid);
      if (paid.gte(lineTotal) && lineTotal.gt(0)) {
        paidPatientIds.add(item.invoice.patientId);
      }
    }

    if (paidPatientIds.size === 0) return 0;

    const ongoing = await this.prisma.encounter.findMany({
      where: {
        encounterType: EncounterType.OUTPATIENT,
        status: EncounterStatus.ONGOING,
        patientId: { in: [...paidPatientIds] },
      },
      select: { patientId: true },
    });
    const ongoingSet = new Set(ongoing.map((e) => e.patientId));

    let n = 0;
    for (const pid of paidPatientIds) {
      if (!ongoingSet.has(pid)) n += 1;
    }
    return n;
  }

  async dashboardSummary(asOf?: string) {
    const anchor = this.anchor(asOf);
    const todayWin = this.dayWindow(anchor);
    const yAnchor = new Date(anchor);
    yAnchor.setDate(yAnchor.getDate() - 1);
    const yesterdayWin = this.dayWindow(yAnchor);

    const [
      appointmentsToday,
      appointmentsYesterday,
      checkInsToday,
      dischargesToday,
      waitingRoomCount,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          date: { gte: todayWin.from, lte: todayWin.to },
        },
      }),
      this.prisma.appointment.count({
        where: {
          date: { gte: yesterdayWin.from, lte: yesterdayWin.to },
        },
      }),
      this.prisma.waitingPatient.count({
        where: {
          createdAt: { gte: todayWin.from, lte: todayWin.to },
        },
      }),
      this.prisma.admission.count({
        where: {
          status: AdmissionStatus.DISCHARGED,
          OR: [
            {
              dischargeDateTime: { gte: todayWin.from, lte: todayWin.to },
            },
            {
              dischargeDateTime: null,
              dischargeDate: { gte: todayWin.from, lte: todayWin.to },
            },
          ],
        },
      }),
      this.waitingRoomCount(anchor),
    ]);

    const cmp = compareMetrics(appointmentsToday, appointmentsYesterday);

    return {
      asOf: anchor.toISOString(),
      window: {
        start: todayWin.from.toISOString(),
        end: todayWin.to.toISOString(),
      },
      appointmentsToday,
      appointmentsYesterday,
      appointmentsChange: {
        percentChange: cmp.percentChange,
        direction: cmp.direction,
      },
      checkInsToday,
      waitingRoomCount,
      dischargesToday,
    };
  }

  private formatPatientName(p: {
    firstName: string | null;
    surname: string | null;
  }): string {
    const parts = [p.firstName, p.surname].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Unknown';
  }

  async liveQueue(asOf?: string): Promise<FrontdeskQueueRow[]> {
    const anchor = this.anchor(asOf);
    const { from, to } = this.dayWindow(anchor);

    const [waitingRows, encounters] = await Promise.all([
      this.prisma.waitingPatient.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          seen: false,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          patient: {
            select: { id: true, firstName: true, surname: true },
          },
          consultingRoom: {
            include: {
              staff: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
      this.prisma.encounter.findMany({
        where: {
          encounterType: EncounterType.OUTPATIENT,
          status: EncounterStatus.ONGOING,
          startTime: { gte: from, lte: to },
        },
        orderBy: { startTime: 'asc' },
        include: {
          patient: {
            select: { id: true, firstName: true, surname: true },
          },
          doctor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const wpByPatient = new Map<string, (typeof waitingRows)[0]>();
    for (const w of waitingRows) {
      wpByPatient.set(w.patientId, w);
    }

    const encounterPatientIds = new Set(encounters.map((e) => e.patientId));

    const out: FrontdeskQueueRow[] = [];

    for (const e of encounters) {
      const wp = wpByPatient.get(e.patientId);
      const room =
        wp?.consultingRoom != null
          ? { id: wp.consultingRoom.id, name: wp.consultingRoom.name }
          : null;

      out.push({
        id: `en:${e.id}`,
        patientId: e.patientId,
        patientName: this.formatPatientName(e.patient),
        time: e.startTime.toISOString(),
        doctor: e.doctor
          ? {
              id: e.doctor.id,
              firstName: e.doctor.firstName,
              lastName: e.doctor.lastName,
            }
          : null,
        status: 'InConsultation',
        assignedRoom: room,
        waitingPatientId: wp?.id ?? null,
        encounterId: e.id,
      });
    }

    for (const w of waitingRows) {
      if (encounterPatientIds.has(w.patientId)) continue;

      const status: FrontdeskQueueStatus = w.consultingRoomId
        ? 'InRoom'
        : 'Waiting';

      const roomDoc = w.consultingRoom?.staff ?? null;

      out.push({
        id: `wp:${w.id}`,
        patientId: w.patientId,
        patientName: this.formatPatientName(w.patient),
        time: w.createdAt.toISOString(),
        doctor: roomDoc
          ? {
              id: roomDoc.id,
              firstName: roomDoc.firstName,
              lastName: roomDoc.lastName,
            }
          : null,
        status,
        assignedRoom: w.consultingRoom
          ? { id: w.consultingRoom.id, name: w.consultingRoom.name }
          : null,
        waitingPatientId: w.id,
        encounterId: null,
      });
    }

    out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return out;
  }
}
