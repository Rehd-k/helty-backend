import { BadRequestException } from '@nestjs/common';
import { AdmissionStatus } from '@prisma/client';

jest.mock('../invoice/invoice.service', () => ({
  InvoiceService: jest.fn().mockImplementation(() => ({
    recalculateInvoiceTotals: jest.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      totalAmount: 100,
      amountPaid: 0,
    }),
  })),
}));

import { AdmissionService } from './admission.service';

function makeInvoiceService(overrides: Record<string, unknown> = {}) {
  return {
    recalculateInvoiceTotals: jest.fn().mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      totalAmount: 100,
      amountPaid: 0,
    }),
    ...overrides,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  const tx: any = {
    patient: {
      update: jest.fn().mockResolvedValue({}),
    },
    ward: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'opd-ward-1', name: 'OPD' }]),
    },
    admission: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'adm-1',
        patientId: 'pat-1',
        status: AdmissionStatus.ACTIVE,
        outcome: null,
        encounter: { id: 'enc-1' },
        bed: { bedNumber: 'B-12' },
        room: null,
      }),
      update: jest.fn().mockResolvedValue({ id: 'adm-1' }),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'inv-1',
          totalAmount: 100,
          amountPaid: 0,
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'inv-1',
        amountPaid: { gte: () => false, gt: () => false },
        invoiceItems: [],
      }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
    },
    invoiceCoverage: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    invoiceItemUsageSegment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
  return tx;
}

describe('AdmissionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('clinical discharge with unpaid invoices moves to PENDING_BILLING_CLEARANCE', async () => {
    const tx = makeTx();
    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    await service.update(
      'adm-1',
      {
        dischargeDate: '2026-03-27T11:00:00.000Z',
        outcome: 'Duly Discharged',
        dischargeSummary: 'Stable for home.',
      },
      'staff-1',
    );

    expect(tx.invoiceItemUsageSegment.updateMany).toHaveBeenCalled();
    expect(tx.patient.update).not.toHaveBeenCalled();
    expect(tx.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          clinicallyDischargedById: 'staff-1',
          dischargeSummary: 'Stable for home.',
          bedId: null,
          room: 'B-12',
        }),
      }),
    );
  });

  it('clinical discharge with paid invoices still awaits nurses clearance', async () => {
    const tx = makeTx({
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            totalAmount: 100,
            amountPaid: 100,
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.ACTIVE,
          encounter: { id: 'enc-1' },
          bed: null,
          room: 'Room 2',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'adm-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          billingClearedAt: new Date('2026-03-27T11:00:00.000Z'),
        }),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    const result = await service.update(
      'adm-1',
      {
        dischargeDate: '2026-03-27T11:00:00.000Z',
        outcome: 'Duly Discharged',
      },
      'staff-1',
    );

    expect(result.status).toBe(AdmissionStatus.PENDING_BILLING_CLEARANCE);
    expect(tx.patient.update).not.toHaveBeenCalled();
    expect(tx.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          billingClearedById: 'staff-1',
          clinicallyDischargedById: 'staff-1',
        }),
      }),
    );
  });

  it('death outcome finalizes immediately regardless of invoice payment', async () => {
    const tx = makeTx({
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.ACTIVE,
          encounter: { id: 'enc-1' },
          bed: null,
          room: null,
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ id: 'adm-1' })
          .mockResolvedValueOnce({
            id: 'adm-1',
            status: AdmissionStatus.DECEASED,
          }),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    const result = await service.update(
      'adm-1',
      {
        dischargeDate: '2026-03-27T11:00:00.000Z',
        outcome: 'Death',
      },
      'staff-1',
    );

    expect(result.status).toBe(AdmissionStatus.DECEASED);
    expect(tx.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DECEASED', wardId: null }),
      }),
    );
  });

  it('billing clearance records billing only until nurses also clear', async () => {
    const tx = makeTx({
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          outcome: 'Duly Discharged',
          billingClearedAt: null,
          nursesClearedAt: null,
          encounter: { id: 'enc-1' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'adm-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          billingClearedAt: new Date('2026-03-27T12:00:00.000Z'),
          nursesClearedAt: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          outcome: 'Duly Discharged',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          billingClearedAt: new Date('2026-03-27T12:00:00.000Z'),
          nursesClearedAt: null,
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            invoiceID: 'INV-001',
            status: 'PAID',
            totalAmount: 100,
            amountPaid: 100,
          },
        ]),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    const result = await service.clearBillingClearance('adm-1', 'billing-1');

    expect(result.status).toBe(AdmissionStatus.PENDING_BILLING_CLEARANCE);
    expect(tx.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingClearedById: 'billing-1',
        }),
      }),
    );
    expect(tx.patient.update).not.toHaveBeenCalled();
  });

  it('nurses clearance finalizes when billing already cleared', async () => {
    const clearedAt = new Date('2026-03-27T12:00:00.000Z');
    const tx = makeTx({
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          outcome: 'Duly Discharged',
          billingClearedAt: clearedAt,
          nursesClearedAt: null,
          encounter: { id: 'enc-1' },
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'adm-1',
            patientId: 'pat-1',
            outcome: 'Duly Discharged',
            status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
            billingClearedAt: clearedAt,
            nursesClearedAt: clearedAt,
          })
          .mockResolvedValueOnce({
            id: 'adm-1',
            status: AdmissionStatus.DISCHARGED,
          }),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    const result = await service.clearNursesClearance('adm-1', 'nurse-1');

    expect(result.status).toBe(AdmissionStatus.DISCHARGED);
    expect(tx.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OUTPATIENT',
          wardId: 'opd-ward-1',
        }),
      }),
    );
  });

  it('billing clearance rejects when invoices remain unpaid', async () => {
    const tx = makeTx({
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          outcome: 'Duly Discharged',
          encounter: { id: 'enc-1' },
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            invoiceID: 'INV-001',
            status: 'PARTIALLY_PAID',
            totalAmount: 100,
            amountPaid: 40,
          },
        ]),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    await expect(
      service.clearBillingClearance('adm-1', 'billing-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('billing clearance allows invoices fully covered by discount or HMO', async () => {
    const tx = makeTx({
      admission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          outcome: 'Duly Discharged',
          billingClearedAt: null,
          nursesClearedAt: null,
          encounter: { id: 'enc-1' },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'adm-1',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'adm-1',
          patientId: 'pat-1',
          outcome: 'Duly Discharged',
          status: AdmissionStatus.PENDING_BILLING_CLEARANCE,
          billingClearedAt: new Date('2026-03-27T12:00:00.000Z'),
          nursesClearedAt: null,
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            invoiceID: 'ZS70S124BC',
            status: 'PENDING',
            totalAmount: 5000,
            amountPaid: 0,
          },
        ]),
      },
      invoiceCoverage: {
        groupBy: jest.fn().mockResolvedValue([
          {
            invoiceId: 'inv-1',
            _sum: { amount: 5000 },
          },
        ]),
      },
    });

    const prisma: any = {
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };

    const service = new AdmissionService(prisma, makeInvoiceService() as any);
    const result = await service.clearBillingClearance('adm-1', 'billing-1');

    expect(result.status).toBe(AdmissionStatus.PENDING_BILLING_CLEARANCE);
    expect(tx.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingClearedById: 'billing-1',
        }),
      }),
    );
  });
});
