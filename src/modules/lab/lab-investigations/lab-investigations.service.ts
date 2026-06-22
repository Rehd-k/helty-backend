import { Injectable } from '@nestjs/common';
import { LabRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseDateRange } from '../../../common/utils/date-range';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../../common/utils/patient-display-name.util';
import {
  LabInvestigationsQueryDto,
  LabInvestigationsSortBy,
} from './dto/lab-investigations-query.dto';
import { SortOrder } from '../../../common/dto/sort-order.dto';

export type LabInvestigationRow = {
  source: 'lab_order_item' | 'lab_request';
  id: string;
  testName: string;
  status: string;
  amount: number;
  quantity: number;
  sampleCollected: boolean;
  sampleCollectedAt: string | null;
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

type DepartmentRef = { id: string; name: string } | null;

@Injectable()
export class LabInvestigationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: LabInvestigationsQueryDto) {
    const rows = await this.fetchAllRows(query);
    const { from, to } = parseDateRange(query.fromDate, query.toDate);

    let sampleCollectedCount = 0;
    let samplePendingCount = 0;
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
      if (row.sampleCollected) sampleCollectedCount++;
      else samplePendingCount++;

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
      sampleCollectedCount,
      samplePendingCount,
      byTestName: [...byTestName.values()].sort((a, b) =>
        a.testName.localeCompare(b.testName),
      ),
      byDepartment: [...byDepartment.values()].sort((a, b) =>
        a.departmentName.localeCompare(b.departmentName),
      ),
    };
  }

  async list(query: LabInvestigationsQueryDto) {
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

  private async fetchAllRows(
    query: LabInvestigationsQueryDto,
  ): Promise<LabInvestigationRow[]> {
    const { from, to } = parseDateRange(query.fromDate, query.toDate);
    const [orderItems, requests] = await Promise.all([
      this.fetchOrderItemRows(query, from, to),
      this.fetchRequestRows(query, from, to),
    ]);
    return [...orderItems, ...requests];
  }

  private buildOrderItemWhere(
    query: LabInvestigationsQueryDto,
    from: Date,
    to: Date,
  ): Prisma.LabOrderItemWhereInput {
    const and: Prisma.LabOrderItemWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
    ];

    if (query.categoryId) {
      and.push({ testVersion: { test: { categoryId: query.categoryId } } });
    }

    if (query.testName?.trim()) {
      const needle = query.testName.trim();
      and.push({
        OR: [
          {
            testVersion: {
              test: { name: { contains: needle, mode: 'insensitive' } },
            },
          },
          {
            order: {
              invoiceItem: {
                service: { name: { contains: needle, mode: 'insensitive' } },
              },
            },
          },
        ],
      });
    }

    if (query.status?.trim()) {
      and.push({ status: query.status.trim() });
    }

    if (query.departmentId) {
      and.push({
        OR: [
          {
            order: {
              invoiceItem: {
                service: { departmentId: query.departmentId },
              },
            },
          },
          { order: { patient: { wardId: query.departmentId } } },
        ],
      });
    }

    if (query.sampleCollected === true) {
      and.push({
        OR: [
          { sample: { isNot: null } },
          { order: { sampleCollectedAt: { not: null } } },
        ],
      });
    } else if (query.sampleCollected === false) {
      and.push({ sample: null });
      and.push({ order: { sampleCollectedAt: null } });
    }

    return { AND: and };
  }

  private buildRequestWhere(
    query: LabInvestigationsQueryDto,
    from: Date,
    to: Date,
  ): Prisma.LabRequestWhereInput | null {
    if (query.categoryId) return null;

    const and: Prisma.LabRequestWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
      { invoiceItem: { labOrder: null } },
    ];

    if (query.testName?.trim()) {
      const needle = query.testName.trim();
      and.push({
        OR: [
          { testType: { contains: needle, mode: 'insensitive' } },
          {
            invoiceItem: {
              service: { name: { contains: needle, mode: 'insensitive' } },
            },
          },
        ],
      });
    }

    if (query.status?.trim()) {
      and.push({
        status: query.status.trim() as LabRequestStatus,
      });
    }

    if (query.departmentId) {
      and.push({
        OR: [
          {
            invoiceItem: {
              service: { departmentId: query.departmentId },
            },
          },
          { patient: { wardId: query.departmentId } },
        ],
      });
    }

    if (query.sampleCollected === true) {
      and.push({ status: LabRequestStatus.COLLECTED });
    } else if (query.sampleCollected === false) {
      and.push({ status: { not: LabRequestStatus.COLLECTED } });
    }

    return { AND: and };
  }

  private async fetchOrderItemRows(
    query: LabInvestigationsQueryDto,
    from: Date,
    to: Date,
  ): Promise<LabInvestigationRow[]> {
    const items = await this.prisma.labOrderItem.findMany({
      where: this.buildOrderItemWhere(query, from, to),
      include: {
        sample: { select: { collectionTime: true } },
        testVersion: {
          include: {
            test: {
              select: { id: true, name: true, price: true, categoryId: true },
            },
          },
        },
        order: {
          include: {
            patient: {
              select: {
                ...patientNameFieldsSelect,
                ward: { select: { id: true, name: true } },
              },
            },
            invoiceItem: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                invoice: {
                  select: { id: true, invoiceID: true, status: true },
                },
                service: {
                  select: {
                    id: true,
                    name: true,
                    department: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return items.map((item) => {
      const patient = item.order.patient;
      const invoiceItem = item.order.invoiceItem;
      const sampleCollected =
        !!item.sample || !!item.order.sampleCollectedAt;
      const department = this.resolveDepartment(
        invoiceItem?.service?.department ?? null,
        patient.ward,
      );
      const amount =
        item.testVersion.test.price ?? Number(invoiceItem?.unitPrice ?? 0);

      return {
        source: 'lab_order_item' as const,
        id: item.id,
        testName: item.testVersion.test.name,
        status: item.status,
        amount,
        quantity: invoiceItem?.quantity ?? 1,
        sampleCollected,
        sampleCollectedAt:
          (
            item.sample?.collectionTime ?? item.order.sampleCollectedAt
          )?.toISOString() ?? null,
        department,
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          firstName: patient.firstName,
          otherName: patient.otherName,
          surname: patient.surname,
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

  private async fetchRequestRows(
    query: LabInvestigationsQueryDto,
    from: Date,
    to: Date,
  ): Promise<LabInvestigationRow[]> {
    const where = this.buildRequestWhere(query, from, to);
    if (!where) return [];

    const requests = await this.prisma.labRequest.findMany({
      where,
      include: {
        patient: {
          select: {
            ...patientNameFieldsSelect,
            ward: { select: { id: true, name: true } },
          },
        },
        invoiceItem: {
          include: {
            invoice: { select: { id: true, invoiceID: true, status: true } },
            service: {
              select: {
                id: true,
                name: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return requests.map((req) => {
      const patient = req.patient;
      const invoiceItem = req.invoiceItem;
      const testName =
        req.testType?.trim() || invoiceItem?.service?.name || 'Lab request';
      const department = this.resolveDepartment(
        invoiceItem?.service?.department ?? null,
        patient.ward,
      );
      const amount =
        Number(invoiceItem?.unitPrice ?? 0) * (invoiceItem?.quantity ?? 1);
      const sampleCollected = req.status === LabRequestStatus.COLLECTED;

      return {
        source: 'lab_request' as const,
        id: req.id,
        testName,
        status: req.status,
        amount,
        quantity: invoiceItem?.quantity ?? 1,
        sampleCollected,
        sampleCollectedAt: sampleCollected
          ? req.updatedAt.toISOString()
          : null,
        department,
        patient: {
          id: patient.id,
          patientId: patient.patientId,
          firstName: patient.firstName,
          otherName: patient.otherName,
          surname: patient.surname,
        },
        patientName: formatPatientDisplayName(patient),
        createdAt: req.createdAt.toISOString(),
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

  private resolveDepartment(
    serviceDept: DepartmentRef,
    ward: { id: string; name: string } | null | undefined,
  ): DepartmentRef {
    if (serviceDept) return serviceDept;
    if (ward) return { id: ward.id, name: ward.name };
    return null;
  }

  private sortRows(
    rows: LabInvestigationRow[],
    query: LabInvestigationsQueryDto,
  ): LabInvestigationRow[] {
    const sortBy = query.sortBy ?? LabInvestigationsSortBy.createdAt;
    const order = query.sortOrder ?? SortOrder.desc;
    const dir = order === SortOrder.asc ? 1 : -1;

    return [...rows].sort((a, b) => {
      switch (sortBy) {
        case LabInvestigationsSortBy.testName:
          return a.testName.localeCompare(b.testName) * dir;
        case LabInvestigationsSortBy.amount:
          return (a.amount - b.amount) * dir;
        case LabInvestigationsSortBy.patientName:
          return a.patientName.localeCompare(b.patientName) * dir;
        case LabInvestigationsSortBy.status:
          return a.status.localeCompare(b.status) * dir;
        case LabInvestigationsSortBy.createdAt:
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
