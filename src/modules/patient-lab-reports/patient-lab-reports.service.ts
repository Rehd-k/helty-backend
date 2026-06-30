import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { ListLabReportsQueryDto } from './dto/list-lab-reports-query.dto';
import {
  toLabReportDetailDto,
  toLabReportSummaryDto,
} from './patient-lab-reports.util';

const LAB_ORDER_LIST_INCLUDE = {
  doctor: { select: { firstName: true, lastName: true } },
  items: {
    include: {
      testVersion: {
        include: { test: { select: { name: true } } },
      },
      results: {
        select: { abnormalFlag: true, isCritical: true },
      },
    },
  },
} as const;

const LAB_ORDER_DETAIL_INCLUDE = {
  doctor: { select: { firstName: true, lastName: true } },
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      testVersion: {
        include: { test: { select: { name: true } } },
      },
      results: {
        orderBy: { field: { position: 'asc' as const } },
        include: {
          field: {
            select: {
              label: true,
              unit: true,
              referenceRange: true,
              position: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class PatientLabReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLabReports(
    user: PatientJwtPayload,
    query: ListLabReportsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { patientId: user.sub };

    const [orders, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: LAB_ORDER_LIST_INCLUDE,
      }),
      this.prisma.labOrder.count({ where }),
    ]);

    return {
      data: orders.map(toLabReportSummaryDto),
      total,
      page,
      limit,
    };
  }

  async getLabReport(user: PatientJwtPayload, id: string) {
    const order = await this.prisma.labOrder.findFirst({
      where: {
        id,
        patientId: user.sub,
      },
      include: LAB_ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Lab report "${id}" not found.`);
    }

    return toLabReportDetailDto(order);
  }
}
