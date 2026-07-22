import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { labRequestWithBillingInclude } from '../lab-request/lab-request-includes';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

const medicationOrderInclude = {
  drug: { select: { id: true, genericName: true, brandName: true } },
  doctor: { select: { id: true, firstName: true, lastName: true } },
  invoiceItem: {
    select: {
      id: true,
      unitPrice: true,
      clinicalPackageItemId: true,
      invoice: { select: { id: true, status: true } },
    },
  },
} satisfies Prisma.MedicationOrderInclude;

const radiologyOrderInclude = {
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  items: {
    include: {
      invoiceItem: {
        select: {
          id: true,
          clinicalPackageItemId: true,
          service: { select: { id: true, name: true } },
        },
      },
      report: {
        include: {
          signedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.RadiologyOrderInclude;

@Injectable()
export class PregnancyClinicalService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadPregnancyOrThrow(id: string) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        encounterId: true,
        lmp: true,
        createdAt: true,
        status: true,
      },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${id}" not found.`);
    }
    return pregnancy;
  }

  async getClinicalOrders(pregnancyId: string) {
    const pregnancy = await this.loadPregnancyOrThrow(pregnancyId);
    const encounterId = pregnancy.encounterId;
    const orderScope = {
      OR: [
        { pregnancyId },
        ...(encounterId ? [{ encounterId }] : []),
      ],
    };

    const [medicationOrders, labRequests, radiologyOrders] = await Promise.all([
      this.prisma.medicationOrder.findMany({
        where: orderScope,
        orderBy: { createdAt: 'desc' },
        include: medicationOrderInclude,
      }),
      this.prisma.labRequest.findMany({
        where: orderScope,
        orderBy: { createdAt: 'desc' },
        include: labRequestWithBillingInclude,
      }),
      this.prisma.radiologyOrder.findMany({
        where: orderScope,
        orderBy: { createdAt: 'desc' },
        include: radiologyOrderInclude,
      }),
    ]);

    return {
      pregnancyId,
      encounterId,
      medicationOrders,
      labRequests,
      radiologyOrders,
    };
  }

  async getClinicalResults(pregnancyId: string) {
    const pregnancy = await this.loadPregnancyOrThrow(pregnancyId);
    const fromDate = pregnancy.lmp ?? pregnancy.createdAt;

    const radiologyWhere: Prisma.RadiologyOrderWhereInput = {
      patientId: pregnancy.patientId,
      createdAt: { gte: fromDate },
      ...(pregnancy.encounterId
        ? {
            OR: [
              { pregnancyId },
              { encounterId: pregnancy.encounterId },
            ],
          }
        : { pregnancyId }),
    };

    const labOrderWhere: Prisma.LabOrderWhereInput = {
      patientId: pregnancy.patientId,
      createdAt: { gte: fromDate },
    };
    const labScopeOr: Prisma.LabOrderWhereInput[] = [];
    if (pregnancy.encounterId) {
      labScopeOr.push({
        invoiceItem: {
          labRequest: { encounterId: pregnancy.encounterId },
        },
      });
    }
    labScopeOr.push({
      invoiceItem: { labRequest: { pregnancyId } },
    });
    if (labScopeOr.length > 0) {
      labOrderWhere.OR = labScopeOr;
    }

    const [labOrders, radiologyOrders] = await Promise.all([
      this.prisma.labOrder.findMany({
        where: labOrderWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              testVersion: {
                include: {
                  test: { select: { id: true, name: true } },
                },
              },
              results: { include: { field: true } },
            },
          },
        },
      }),
      this.prisma.radiologyOrder.findMany({
        where: radiologyWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              report: {
                include: {
                  signedBy: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
              images: true,
            },
          },
          patient: { select: patientNameFieldsSelect },
        },
      }),
    ]);

    return {
      pregnancyId,
      patientId: pregnancy.patientId,
      fromDate,
      labOrders,
      radiologyOrders,
    };
  }
}
