import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QualitySafetyService } from './quality-safety.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QualitySafetyService', () => {
  let service: QualitySafetyService;
  const prisma = {
    referral: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patientComplaint: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    safetyIncident: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    infectionCase: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualitySafetyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(QualitySafetyService);
    jest.clearAllMocks();
  });

  it('creates referral with staff id', async () => {
    prisma.referral.create.mockResolvedValue({ id: 'r1' });
    await service.createReferral(
      { patientId: 'p1', direction: 'OUT' as const },
      'staff-1',
    );
    expect(prisma.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'p1',
          createdById: 'staff-1',
        }),
      }),
    );
  });

  it('throws when referral not found', async () => {
    prisma.referral.findUnique.mockResolvedValue(null);
    await expect(service.getReferral('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists complaints with total', async () => {
    prisma.patientComplaint.findMany.mockResolvedValue([]);
    prisma.patientComplaint.count.mockResolvedValue(0);
    const out = await service.listComplaints({});
    expect(out).toEqual({ items: [], total: 0 });
  });
});
