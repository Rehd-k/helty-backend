import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DisplayLane,
  LabOrderStatus,
  PatientStatus,
  Prisma,
  RadiologyRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDay } from '../../common/utils/date-range';
import {
  CONSULTATION_BILLING_CATEGORY,
  CONSULTATION_CREDIT_MAX_VISITS,
} from '../invoice/invoice-link.constants';
import { DisplayBoardRow, shortWaitingName } from './display.types';

const LANE_LIMIT = 40;

const nameSelect = { firstName: true, surname: true } as const;

@Injectable()
export class DisplayBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async boardForStaff(staffId: string, laneRaw: string | undefined) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, isActive: true, accountType: true },
    });
    if (!staff || staff.accountType !== 'DISPLAY') {
      throw new ForbiddenException('Access denied');
    }
    if (!staff.isActive) {
      throw new UnauthorizedException('Display account is inactive');
    }

    const lane = this.parseLane(laneRaw);
    const rows =
      lane === DisplayLane.ALL
        ? await this.allRows()
        : await this.rowsForLane(lane);

    return {
      lane,
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  private parseLane(raw: string | undefined): DisplayLane {
    const key = (raw ?? '').trim().toUpperCase();
    if ((Object.values(DisplayLane) as string[]).includes(key)) {
      return key as DisplayLane;
    }
    throw new BadRequestException(
      'lane is required: TRIAGE, CONSULTATION, PHARMACY, RADIOLOGY, LAB, or ALL',
    );
  }

  private async allRows(): Promise<DisplayBoardRow[]> {
    const lanes = [
      DisplayLane.TRIAGE,
      DisplayLane.CONSULTATION,
      DisplayLane.PHARMACY,
      DisplayLane.RADIOLOGY,
      DisplayLane.LAB,
    ];
    const groups = await Promise.all(lanes.map((lane) => this.rowsForLane(lane)));
    return groups
      .flat()
      .sort((a, b) => a.waitingSince.localeCompare(b.waitingSince))
      .slice(0, LANE_LIMIT * 2);
  }

  private rowsForLane(lane: DisplayLane): Promise<DisplayBoardRow[]> {
    switch (lane) {
      case DisplayLane.TRIAGE:
        return this.consultationRows(lane, false);
      case DisplayLane.CONSULTATION:
        return this.consultationRows(lane, true);
      case DisplayLane.PHARMACY:
        return this.pharmacyRows();
      case DisplayLane.RADIOLOGY:
        return this.radiologyRows();
      case DisplayLane.LAB:
        return this.labRows();
      default:
        return Promise.resolve([]);
    }
  }

  private todayStart() {
    return startOfDay(new Date());
  }

  private outpatientWhere(): Prisma.PatientWhereInput {
    return {
      status: PatientStatus.OUTPATIENT,
      patientId: { not: null },
      NOT: { patientId: '' },
    };
  }

  private touchedToday(): Prisma.InvoiceWhereInput {
    const start = this.todayStart();
    return {
      OR: [{ createdAt: { gte: start } }, { updatedAt: { gte: start } }],
    };
  }

  private consultationItemWhere(): Prisma.InvoiceItemWhereInput {
    const now = new Date();
    return {
      settled: false,
      consultationVisitsConsumed: { lt: CONSULTATION_CREDIT_MAX_VISITS },
      consultationCreditExpiresAt: { gt: now },
      service: {
        category: {
          name: {
            equals: CONSULTATION_BILLING_CATEGORY,
            mode: 'insensitive',
          },
        },
      },
    };
  }

  private async consultationRows(
    lane: DisplayLane,
    hasVitals: boolean,
  ): Promise<DisplayBoardRow[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        AND: [
          this.touchedToday(),
          {
            status: 'PAID',
            deletedAt: null,
            encounterId: null,
            vitalsId: hasVitals ? { not: null } : null,
            patient: this.outpatientWhere(),
            invoiceItems: { some: this.consultationItemWhere() },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: LANE_LIMIT,
      select: {
        invoiceID: true,
        createdAt: true,
        consultingRoom: { select: { name: true } },
        patient: { select: nameSelect },
      },
    });

    return invoices.map((inv) => ({
      lane,
      ticket: inv.invoiceID,
      displayName: shortWaitingName(inv.patient),
      place: hasVitals
        ? inv.consultingRoom?.name?.trim() || 'Consultation'
        : 'Triage',
      waitingSince: inv.createdAt.toISOString(),
    }));
  }

  private async pharmacyRows(): Promise<DisplayBoardRow[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        AND: [
          this.touchedToday(),
          {
            status: 'PAID',
            deletedAt: null,
            patient: this.outpatientWhere(),
            invoiceItems: {
              some: { drugId: { not: null }, settled: false },
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: LANE_LIMIT,
      select: {
        invoiceID: true,
        createdAt: true,
        patient: { select: nameSelect },
      },
    });

    return invoices.map((inv) => ({
      lane: DisplayLane.PHARMACY,
      ticket: inv.invoiceID,
      displayName: shortWaitingName(inv.patient),
      place: 'Pharmacy',
      waitingSince: inv.createdAt.toISOString(),
    }));
  }

  private async radiologyRows(): Promise<DisplayBoardRow[]> {
    const items = await this.prisma.radiologyOrderItem.findMany({
      where: {
        status: {
          in: [
            RadiologyRequestStatus.PENDING,
            RadiologyRequestStatus.SCHEDULED,
          ],
        },
        createdAt: { gte: this.todayStart() },
        invoiceItem: { invoice: { status: 'PAID', deletedAt: null } },
        order: { admissionId: null, patient: this.outpatientWhere() },
      },
      orderBy: { createdAt: 'asc' },
      take: 120,
      select: {
        createdAt: true,
        scanType: true,
        bodyPart: true,
        invoiceItem: { select: { invoice: { select: { invoiceID: true } } } },
        order: {
          select: {
            patientId: true,
            patient: { select: nameSelect },
          },
        },
      },
    });

    const byPatient = new Map<string, DisplayBoardRow & { extras: string[] }>();
    for (const item of items) {
      const place = [item.scanType.replaceAll('_', ' '), item.bodyPart]
        .filter(Boolean)
        .join(' · ');
      const existing = byPatient.get(item.order.patientId);
      if (!existing) {
        byPatient.set(item.order.patientId, {
          lane: DisplayLane.RADIOLOGY,
          ticket: item.invoiceItem?.invoice.invoiceID ?? 'RAD',
          displayName: shortWaitingName(item.order.patient),
          place: place || 'Radiology',
          waitingSince: item.createdAt.toISOString(),
          extras: [],
        });
        continue;
      }
      if (place && place !== existing.place && !existing.extras.includes(place)) {
        existing.extras.push(place);
      }
    }

    return [...byPatient.values()].slice(0, LANE_LIMIT).map((row) => ({
      lane: row.lane,
      ticket: row.ticket,
      displayName: row.displayName,
      place:
        row.extras.length > 0
          ? `${row.place} +${row.extras.length}`
          : row.place,
      waitingSince: row.waitingSince,
    }));
  }

  private async labRows(): Promise<DisplayBoardRow[]> {
    const orders = await this.prisma.labOrder.findMany({
      where: {
        status: LabOrderStatus.PENDING,
        admissionId: null,
        createdAt: { gte: this.todayStart() },
        patient: this.outpatientWhere(),
        invoiceItem: { invoice: { status: 'PAID', deletedAt: null } },
      },
      orderBy: { createdAt: 'asc' },
      take: 120,
      select: {
        createdAt: true,
        patientId: true,
        patient: { select: nameSelect },
        invoiceItem: { select: { invoice: { select: { invoiceID: true } } } },
        items: {
          select: {
            testVersion: { select: { test: { select: { name: true } } } },
          },
        },
      },
    });

    const byPatient = new Map<string, DisplayBoardRow & { extras: number }>();
    for (const order of orders) {
      const tests = order.items
        .map((item) => item.testVersion.test.name.trim())
        .filter(Boolean);
      const existing = byPatient.get(order.patientId);
      if (!existing) {
        byPatient.set(order.patientId, {
          lane: DisplayLane.LAB,
          ticket: order.invoiceItem?.invoice.invoiceID ?? 'LAB',
          displayName: shortWaitingName(order.patient),
          place: tests[0] || 'Laboratory',
          waitingSince: order.createdAt.toISOString(),
          extras: Math.max(0, tests.length - 1),
        });
        continue;
      }
      existing.extras += Math.max(1, tests.length);
    }

    return [...byPatient.values()].slice(0, LANE_LIMIT).map((row) => ({
      lane: row.lane,
      ticket: row.ticket,
      displayName: row.displayName,
      place: row.extras > 0 ? `${row.place} +${row.extras}` : row.place,
      waitingSince: row.waitingSince,
    }));
  }
}
