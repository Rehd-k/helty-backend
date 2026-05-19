import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PatientChartQueryDto } from './dto/patient-chart-query.dto';
import { endOfDay, startOfDay } from '../../common/utils/date-range';

export const PATIENT_CHART_SECTIONS = [
  'encounters',
  'admissions',
  'medicationOrders',
  'prescriptions',
  'labOrders',
  'labRequests',
  'labReports',
  'radiologyOrders',
  'radiologyReports',
  'vitals',
  'allergies',
  'appointments',
  'invoices',
  'payments',
  'wallet',
  'medicalHistories',
  'doctorReports',
  'archivedEncounters',
] as const;

export type PatientChartSection = (typeof PATIENT_CHART_SECTIONS)[number];

type ChartQuery = {
  limit: number;
  skip: number;
  fromDate?: string;
  toDate?: string;
};

@Injectable()
export class PatientChartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async getChart(patientId: string, query: PatientChartQueryDto) {
    const limit = query.limit ?? 20;
    const skip = query.skip ?? 0;
    const chartQuery: ChartQuery = {
      limit,
      skip,
      fromDate: query.fromDate,
      toDate: query.toDate,
    };

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        surname: true,
        otherName: true,
        dob: true,
        gender: true,
        phoneNumber: true,
        email: true,
        status: true,
        ward: { select: { id: true, name: true } },
        hmoProvider: { select: { id: true, name: true, code: true } },
      },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    const requested = this.parseInclude(query.include);
    const summary = await this.buildSummary(patientId);

    const result: Record<string, unknown> = {
      patient,
      summary,
      availableSections: [...PATIENT_CHART_SECTIONS],
    };

    if (!requested.length) {
      return result;
    }

    const sections = await Promise.all(
      requested.map(async (section) => {
        const data = await this.loadSection(section, patientId, chartQuery);
        return [section, data] as const;
      }),
    );
    for (const [key, value] of sections) {
      result[key] = value;
    }
    return result;
  }

  private parseInclude(include?: string): PatientChartSection[] {
    if (!include?.trim()) return [];
    const keys = include
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const invalid = keys.filter(
      (k) => !PATIENT_CHART_SECTIONS.includes(k as PatientChartSection),
    );
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid include section(s): ${invalid.join(', ')}. Allowed: ${PATIENT_CHART_SECTIONS.join(', ')}.`,
      );
    }
    return keys as PatientChartSection[];
  }

  private buildDateFilter(
    field: string,
    fromDate?: string,
    toDate?: string,
  ): Record<string, unknown> | undefined {
    if (!fromDate && !toDate) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (fromDate) {
      const d = new Date(fromDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(`Invalid fromDate: ${fromDate}`);
      }
      range.gte = startOfDay(d);
    }
    if (toDate) {
      const d = new Date(toDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(`Invalid toDate: ${toDate}`);
      }
      range.lte = endOfDay(d);
    }
    return { [field]: range };
  }

  private async buildSummary(patientId: string) {
    const [
      encounterCount,
      admissionCount,
      openInvoiceCount,
      wallet,
      archivedEncounterGroupCount,
    ] = await Promise.all([
      this.prisma.encounter.count({ where: { patientId } }),
      this.prisma.admission.count({ where: { patientId } }),
      this.prisma.invoice.count({
        where: {
          patientId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        },
      }),
      this.prisma.patientWallet.findUnique({ where: { patientId } }),
      this.prisma.patientArchivedEncounter.count({ where: { patientId } }),
    ]);

    return {
      encounterCount,
      admissionCount,
      openInvoiceCount,
      walletBalance: wallet ? Number(wallet.balance) : 0,
      archivedEncounterGroupCount,
    };
  }

  private async loadSection(
    section: PatientChartSection,
    patientId: string,
    q: ChartQuery,
  ): Promise<unknown> {
    switch (section) {
      case 'encounters':
        return this.prisma.encounter.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('startTime', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { startTime: 'desc' },
          include: {
            doctor: {
              select: { id: true, firstName: true, lastName: true, staffId: true },
            },
            diagnoses: true,
            admission: { select: { id: true, status: true } },
          },
        });
      case 'admissions':
        return this.prisma.admission.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('admissionDate', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { admissionDate: 'desc' },
          include: {
            wardEntity: { select: { id: true, name: true } },
            bed: { select: { id: true, bedNumber: true } },
            attendingDoctor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      case 'medicationOrders':
        return this.prisma.medicationOrder.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { id: true, firstName: true, lastName: true } },
            drug: { select: { id: true, genericName: true, brandName: true } },
            encounter: { select: { id: true, startTime: true, status: true } },
          },
        });
      case 'prescriptions':
        return this.prisma.prescription.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('startDate', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { startDate: 'desc' },
        });
      case 'labOrders':
        return this.prisma.labOrder.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { id: true, firstName: true, lastName: true } },
            items: {
              include: {
                testVersion: {
                  include: { test: { select: { id: true, name: true } } },
                },
                results: true,
              },
            },
          },
        });
      case 'labRequests':
        return this.prisma.labRequest.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            encounter: { select: { id: true, startTime: true } },
            invoice: { select: { id: true, invoiceID: true, status: true } },
          },
        });
      case 'labReports':
        return this.prisma.labReport.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('date', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { date: 'desc' },
        });
      case 'radiologyOrders':
        return this.prisma.radiologyOrder.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            items: {
              include: {
                schedule: true,
                procedure: true,
                report: {
                  select: {
                    id: true,
                    signedAt: true,
                    signedBy: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        });
      case 'radiologyReports':
        return this.prisma.radiologyReport.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('date', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { date: 'desc' },
        });
      case 'vitals':
        return this.prisma.patientVitals.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            nurse: { select: { id: true, firstName: true, lastName: true } },
          },
        });
      case 'allergies':
        return this.prisma.patientAllergy.findMany({
          where: { patientId },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
        });
      case 'appointments':
        return this.prisma.appointment.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('date', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { date: 'desc' },
        });
      case 'invoices':
        return this.prisma.invoice.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            invoiceItems: {
              include: {
                service: { select: { id: true, name: true, cost: true } },
              },
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              include: {
                receivedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        });
      case 'payments':
        return this.prisma.payment.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('date', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { date: 'desc' },
        });
      case 'wallet': {
        const wallet = await this.invoiceService.getWallet(patientId);
        const transactions = await this.prisma.walletTransaction.findMany({
          where: { walletId: wallet.id },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: { select: { id: true, invoiceID: true, status: true } },
          },
        });
        return { wallet, transactions };
      }
      case 'medicalHistories':
        return this.prisma.medicalHistory.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
        });
      case 'doctorReports':
        return this.prisma.doctorReport.findMany({
          where: {
            patientId,
            ...this.buildDateFilter('createdAt', q.fromDate, q.toDate),
          },
          skip: q.skip,
          take: q.limit,
          orderBy: { createdAt: 'desc' },
        });
      case 'archivedEncounters':
        return this.listArchivedEncounters(patientId, q);
      default:
        return null;
    }
  }

  private async listArchivedEncounters(patientId: string, q: ChartQuery) {
    return this.prisma.patientArchivedEncounter.findMany({
      where: {
        patientId,
        ...this.buildDateFilter('encounterOccurredAt', q.fromDate, q.toDate),
      },
      skip: q.skip,
      take: q.limit,
      orderBy: { encounterOccurredAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });
  }
}
