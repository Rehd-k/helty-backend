import { AccountType, EncounterStatus, EncounterType, StaffRole } from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: () => 'TESTIDAB',
}));

import { EncounterService } from './encounter.service';

describe('EncounterService proceduresJson billing', () => {
  const encounterId = 'enc-1';
  const patientId = 'pat-1';
  const doctorId = 'doc-1';
  const serviceId = 'svc-1';

  const invoiceService = {
    assertInpatientCreditAllowed: jest.fn(),
    assertServiceCategoryForProcedureBilling: jest
      .fn()
      .mockResolvedValue(undefined),
    createWithServiceItem: jest.fn().mockResolvedValue({
      invoice: { id: 'inv-1' },
      invoiceItemId: 'item-1',
    }),
    removeBillableLineForEncounterRequest: jest.fn(),
  };

  const editPolicy = {
    assertCanEdit: jest.fn().mockResolvedValue({
      id: encounterId,
      status: EncounterStatus.ONGOING,
      doctorId,
    }),
    buildClinicalSnapshot: jest.fn(),
    computeEncounterFieldChanges: jest.fn(),
    recordEditIfCompleted: jest.fn(),
  };

  const tx = {
    encounter: {
      update: jest.fn().mockResolvedValue({ id: encounterId }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
      cb(tx),
    ),
    encounter: {
      findUnique: jest.fn().mockResolvedValue({
        id: encounterId,
        patientId,
        doctorId,
        proceduresJson: null,
        status: EncounterStatus.ONGOING,
      }),
    },
  };

  let service: EncounterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EncounterService(
      prisma as any,
      invoiceService as any,
      editPolicy as any,
    );
  });

  it('creates billed procedure lines without checking active admission', async () => {
    const proceduresJson = JSON.stringify([
      {
        type: 'PROC-1',
        consent: 'Yes',
        notes: '',
        complications: '',
        serviceId,
      },
    ]);

    await service.update(encounterId, { proceduresJson }, doctorId);

    expect(invoiceService.assertInpatientCreditAllowed).not.toHaveBeenCalled();
    expect(
      invoiceService.assertServiceCategoryForProcedureBilling,
    ).toHaveBeenCalledWith(serviceId);
    expect(invoiceService.createWithServiceItem).toHaveBeenCalledWith({
      patientId,
      encounterId,
      staffId: doctorId,
      serviceId,
    });
    expect(tx.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: encounterId },
        data: expect.objectContaining({
          proceduresJson: expect.stringContaining('"invoiceItemId":"item-1"'),
        }),
      }),
    );
  });
});

describe('EncounterService.complete', () => {
  const encounterId = 'enc-1';
  const doctorId = 'doc-1';
  const superAdminId = 'admin-1';

  const invoiceService = {
    settleConsultationItemsForEncounter: jest.fn().mockResolvedValue(undefined),
  };

  const editPolicy = {
    assertCanEdit: jest.fn().mockResolvedValue({
      id: encounterId,
      status: EncounterStatus.ONGOING,
      doctorId,
    }),
  };

  const tx = {
    encounter: {
      update: jest.fn().mockResolvedValue({
        id: encounterId,
        encounterType: EncounterType.OUTPATIENT,
        status: EncounterStatus.COMPLETED,
      }),
    },
  };

  const prisma = {
    staff: { findUnique: jest.fn() },
    encounter: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) =>
      cb(tx),
    ),
  };

  let service: EncounterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EncounterService(
      prisma as any,
      invoiceService as any,
      editPolicy as any,
    );
  });

  it('sets updatedById for regular doctors after assertCanEdit', async () => {
    prisma.staff.findUnique.mockResolvedValue({
      accountType: AccountType.PHYSICIAN,
      staffRole: StaffRole.CONSULTANT,
    });

    await service.complete(encounterId, doctorId);

    expect(editPolicy.assertCanEdit).toHaveBeenCalledWith(
      encounterId,
      doctorId,
    );
    expect(tx.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EncounterStatus.COMPLETED,
          updatedById: doctorId,
        }),
      }),
    );
  });

  it('super admin bypasses assertCanEdit and does not set updatedById', async () => {
    prisma.staff.findUnique.mockResolvedValue({
      accountType: AccountType.SUPER_ADMIN,
      staffRole: StaffRole.SUPER_ADMIN,
    });
    prisma.encounter.findUnique.mockResolvedValue({ id: encounterId });

    await service.complete(encounterId, superAdminId);

    expect(editPolicy.assertCanEdit).not.toHaveBeenCalled();
    expect(tx.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: EncounterStatus.COMPLETED,
          endTime: expect.any(Date),
        },
      }),
    );
    const data = tx.encounter.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('updatedById');
  });
});
