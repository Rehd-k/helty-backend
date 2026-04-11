import { Prisma } from '@prisma/client';

/** Nested billing + lab order/results for API responses and encounter expand. */
export const labRequestWithBillingInclude = {
  encounter: {
    select: { id: true, encounterType: true, status: true },
  },
  patient: {
    select: { id: true, firstName: true, surname: true, patientId: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
  invoice: {
    select: {
      id: true,
      invoiceID: true,
      status: true,
      totalAmount: true,
      amountPaid: true,
    },
  },
  invoiceItem: {
    include: {
      service: { select: { id: true, name: true, cost: true } },
      labOrder: {
        include: {
          items: {
            include: {
              testVersion: {
                include: {
                  test: { select: { id: true, name: true, sampleType: true } },
                  fields: { orderBy: { position: 'asc' } },
                },
              },
              sample: true,
              results: { include: { field: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.LabRequestInclude;
