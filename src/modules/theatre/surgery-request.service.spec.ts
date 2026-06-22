import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SurgeryRequestStatus } from '@prisma/client';
import { SurgeryRequestService } from './surgery-request.service';

describe('SurgeryRequestService', () => {
  const invoiceService = {
    assertServiceCategoryForProcedureBilling: jest
      .fn()
      .mockResolvedValue(undefined),
  };

  const prisma = {
    encounter: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'enc-1',
        patientId: 'pat-1',
      }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'doc-1' }) },
    service: { findUnique: jest.fn().mockResolvedValue({ id: 'svc-1' }) },
    admission: { findUnique: jest.fn() },
    surgeryRequest: {
      create: jest.fn().mockResolvedValue({
        id: 'req-1',
        status: SurgeryRequestStatus.REQUESTED,
      }),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
  };

  let service: SurgeryRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SurgeryRequestService(
      prisma as any,
      invoiceService as any,
    );
  });

  it('creates a surgery request linked to encounter', async () => {
    await service.create({
      encounterId: 'enc-1',
      patientId: 'pat-1',
      requestedById: 'doc-1',
      serviceId: 'svc-1',
    });

    expect(
      invoiceService.assertServiceCategoryForProcedureBilling,
    ).toHaveBeenCalledWith('svc-1');
    expect(prisma.surgeryRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: 'enc-1',
          status: SurgeryRequestStatus.REQUESTED,
        }),
      }),
    );
  });

  it('rejects patient mismatch with encounter', async () => {
    await expect(
      service.create({
        encounterId: 'enc-1',
        patientId: 'other-patient',
        requestedById: 'doc-1',
        serviceId: 'svc-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows cancel while requested', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.REQUESTED,
    });
    prisma.surgeryRequest.update.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.CANCELLED,
    });

    await service.update('req-1', { status: SurgeryRequestStatus.CANCELLED });

    expect(prisma.surgeryRequest.update).toHaveBeenCalled();
  });

  it('rejects cancel after surgery started', async () => {
    prisma.surgeryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: SurgeryRequestStatus.IN_PROGRESS,
    });

    await expect(
      service.update('req-1', { status: SurgeryRequestStatus.CANCELLED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when encounter missing', async () => {
    prisma.encounter.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        encounterId: 'missing',
        patientId: 'pat-1',
        requestedById: 'doc-1',
        serviceId: 'svc-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
