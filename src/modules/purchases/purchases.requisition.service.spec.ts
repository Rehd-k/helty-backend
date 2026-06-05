import { ForbiddenException } from '@nestjs/common';
import { PurchasesRequisitionService } from './purchases.requisition.service';

describe('PurchasesRequisitionService', () => {
  const prisma = {
    requisition: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as ConstructorParameters<typeof PurchasesRequisitionService>[0];

  const service = new PurchasesRequisitionService(prisma);

  it('rejects approve from non-head staff', async () => {
    prisma.requisition.findUnique = jest.fn().mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      lines: [],
      requestedBy: {},
      purchaseOrder: null,
    });
    await expect(
      service.approve('r1', 'staff-1', 'PURCHASES_STORE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
