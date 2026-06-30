import { Injectable } from '@nestjs/common';
import { Prisma, RadiologyModality } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseDateRange } from '../../../common/utils/date-range';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
  toPatientNameDto,
} from '../../../common/utils/patient-display-name.util';
import { SortOrder } from '../../../common/dto/sort-order.dto';
import {
  RadiologyInvestigationsQueryDto,
  RadiologyInvestigationsSortBy,
} from './dto/radiology-investigations-query.dto';

export type RadiologyInvestigationRow = {
  source: 'radiology_order_item';
  id: string;
  testName: string;
  status: string;
  amount: number;
  quantity: number;
  priority: string;
  department: { id: string; name: string } | null;
  patient: {
    id: string;
    patientId: string | null;
    firstName: string | null;
    otherName: string | null;
    surname: string | null;
  };
  patientName: string;
  createdAt: string;
  invoice: {
    id: string;
    invoiceID: string | null;
    status: string;
  } | null;
};

@Injectable()
export class RadiologyInvestigationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: RadiologyInvestigationsQueryDto) {
    const rows = await this.fetchAllRows(query);
    const { from, to } = parseDateRange(query.fromDate, query.toDate);

    let totalAmount = 0;
    const byTestName = new Map<
      string,
      { testName: string; count: number; amount: number }
    >();
    const byDepartment = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        count: number;
        amount: number;
      }
    >();

    for (const row of rows) {
      totalAmount += row.amount;

      const testKey = row.testName || 'Unknown';
      const testAgg = byTestName.get(testKey) ?? {
        testName: testKey,
        count: 0,
        amount: 0,
      };
      testAgg.count += 1;
      testAgg.amount += row.amount;
      byTestName.set(testKey, testAgg);

      if (row.department) {
        const deptAgg = byDepartment.get(row.department.id) ?? {
          departmentId: row.department.id,
          departmentName: row.department.name,
          count: 0,
          amount: 0,
        };
        deptAgg.count += 1;
        deptAgg.amount += row.amount;
        byDepartment.set(row.department.id, deptAgg);
      }
    }

    return {
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
      totalCount: rows.length,
      totalAmount,
      byTestName: [...byTestName.values()].sort((a, b) =>
        a.testName.localeCompare(b.testName),
      ),
      byDepartment: [...byDepartment.values()].sort((a, b) =>
        a.departmentName.localeCompare(b.departmentName),
      ),
    };
  }

  async list(query: RadiologyInvestigationsQueryDto) {
    const rows = this.sortRows(await this.fetchAllRows(query), query);
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    return {
      data: rows.slice(skip, skip + take),
      total: rows.length,
      skip,
      take,
    };
  }

  private buildWhere(
    query: RadiologyInvestigationsQueryDto,
    from: Date,
    to: Date,
  ): Prisma.RadiologyOrderItemWhereInput {
    const and: Prisma.RadiologyOrderItemWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
    ];

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.priority) {
      and.push({ priority: query.priority });
    }

    if (query.departmentId) {
      and.push({ order: { departmentId: query.departmentId } });
    }

    if (query.testName?.trim()) {
      const needle = query.testName.trim();
      const or: Prisma.RadiologyOrderItemWhereInput[] = [
        { bodyPart: { contains: needle, mode: 'insensitive' } },
        {
          invoiceItem: {
            service: { name: { contains: needle, mode: 'insensitive' } },
          },
        },
      ];
      const normalizedNeedle = needle.replace(/[\s-]/g, '_').toUpperCase();
      const modality = Object.values(RadiologyModality).find(
        (value) =>
          value === normalizedNeedle ||
          value.replace(/_/g, '').includes(
            needle.replace(/[\s_-]/g, '').toUpperCase(),
          ),
      );
      if (modality) {
        or.push({ scanType: modality });
      }
      and.push({ OR: or });
    }

    return { AND: and };
  }

  private async fetchAllRows(
    query: RadiologyInvestigationsQueryDto,
  ): Promise<RadiologyInvestigationRow[]> {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);

    const items = await this.prisma.radiologyOrderItem.findMany({
      where: this.buildWhere(query, from, to),
      include: {
        order: {
          include: {
            patient: { select: patientNameFieldsSelect },
            department: { select: { id: true, name: true } },
          },
        },
        invoiceItem: {
          select: {
            quantity: true,
            unitPrice: true,
            invoice: { select: { id: true, invoiceID: true, status: true } },
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    return items.map((item) => {
      const patient = item.order.patient;
      const invoiceItem = item.invoiceItem;
      const serviceName = invoiceItem?.service?.name;
      const testName =
        serviceName ||
        [item.scanType, item.bodyPart].filter(Boolean).join(' - ') ||
        'Radiology scan';
      const amount =
        Number(invoiceItem?.unitPrice ?? 0) * (invoiceItem?.quantity ?? 1);

      return {
        source: 'radiology_order_item' as const,
        id: item.id,
        testName,
        status: item.status,
        amount,
        quantity: invoiceItem?.quantity ?? 1,
        priority: item.priority,
        department: item.order.department,
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          ...toPatientNameDto(patient),
        },
        patientName: formatPatientDisplayName(patient),
        createdAt: item.createdAt.toISOString(),
        invoice: invoiceItem?.invoice
          ? {
              id: invoiceItem.invoice.id,
              invoiceID: invoiceItem.invoice.invoiceID,
              status: invoiceItem.invoice.status,
            }
          : null,
      };
    });
  }

  private sortRows(
    rows: RadiologyInvestigationRow[],
    query: RadiologyInvestigationsQueryDto,
  ): RadiologyInvestigationRow[] {
    const sortBy = query.sortBy ?? RadiologyInvestigationsSortBy.createdAt;
    const order = query.sortOrder ?? SortOrder.desc;
    const dir = order === SortOrder.asc ? 1 : -1;

    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case RadiologyInvestigationsSortBy.testName:
          return a.testName.localeCompare(b.testName) * dir;
        case RadiologyInvestigationsSortBy.amount:
          return (a.amount - b.amount) * dir;
        case RadiologyInvestigationsSortBy.patientName:
          return a.patientName.localeCompare(b.patientName) * dir;
        case RadiologyInvestigationsSortBy.status:
          return a.status.localeCompare(b.status) * dir;
        case RadiologyInvestigationsSortBy.createdAt:
        default:
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
      }
    });
  }
}
