import { BadRequestException } from '@nestjs/common';
import { LabResultService } from './lab-result.service';

describe('LabResultService', () => {
  const invoiceService = {
    assertInvoiceItemPaidOrInpatientCredit: jest.fn(),
    settleInvoiceItemIfPresent: jest.fn().mockResolvedValue(undefined),
  };

  const orderItemRow = {
    orderId: 'ord-1',
    order: { invoiceItemId: 'item-1', patientId: 'pat-1' },
  };

  const prisma = {
    staff: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    labOrderItem: {
      findUnique: jest.fn().mockImplementation((args: { select?: { testVersionId?: boolean; order?: unknown } }) => {
        if (args.select?.testVersionId) {
          return Promise.resolve({ testVersionId: 'ver-1' });
        }
        return Promise.resolve(orderItemRow);
      }),
    },
    labTestField: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'field-1',
        testVersionId: 'ver-1',
      }),
    },
    labOrder: {
      findUnique: jest.fn().mockResolvedValue({
        invoiceItemId: null,
        items: [],
      }),
    },
    labRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        labOrderItem: {
          findUnique: jest.fn().mockResolvedValue(orderItemRow),
        },
        labResult: {
          upsert: jest.fn().mockResolvedValue({
            value: '5',
            field: { referenceRange: null, fieldType: 'TEXT' },
          }),
        },
      }),
    ),
  };

  let service: LabResultService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LabResultService(prisma as any, invoiceService as any);
  });

  it('checks payment or inpatient credit before settling on create', async () => {
    await service.create({
      orderItemId: 'oi-1',
      fieldId: 'field-1',
      value: '5',
      enteredBy: 'staff-1',
    });

    expect(
      invoiceService.assertInvoiceItemPaidOrInpatientCredit,
    ).toHaveBeenCalledWith(expect.anything(), {
      invoiceItemId: 'item-1',
      patientId: 'pat-1',
    });
    expect(invoiceService.settleInvoiceItemIfPresent).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
    );
  });

  it('propagates payment gate failure from invoice service', async () => {
    invoiceService.assertInvoiceItemPaidOrInpatientCredit.mockRejectedValue(
      new BadRequestException(
        'Payment is required before entering results for this patient.',
      ),
    );

    await expect(
      service.create({
        orderItemId: 'oi-1',
        fieldId: 'field-1',
        value: '5',
        enteredBy: 'staff-1',
      }),
    ).rejects.toThrow(
      'Payment is required before entering results for this patient.',
    );
    expect(invoiceService.settleInvoiceItemIfPresent).not.toHaveBeenCalled();
  });
});
