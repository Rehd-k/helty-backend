import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PregnancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientCycleService } from './patient-cycle.service';
import { parseDateKey } from './patient-cycle.util';

describe('PatientCycleService', () => {
  const prisma = {
    patientCycleSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    patientCyclePeriod: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pregnancy: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new PatientCycleService(
    prisma as unknown as PrismaService,
  );

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patientCycleSettings.findUnique.mockResolvedValue(null);
    prisma.patientCyclePeriod.findMany.mockResolvedValue([]);
    prisma.pregnancy.findFirst.mockResolvedValue(null);
  });

  it('getCalendar does not insert settings on first read', async () => {
    const result = await service.getCalendar(patientUser, {
      year: 2026,
      month: 9,
    });

    expect(prisma.patientCycleSettings.upsert).not.toHaveBeenCalled();
    expect(result.configured).toBe(false);
    expect(result.settings.isDefault).toBe(true);
    expect(result.predictedDays).toEqual([]);
    expect(prisma.pregnancy.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: 'patient-uuid-1',
        status: PregnancyStatus.ONGOING,
      },
      select: { id: true },
    });
  });

  it('skips predictions when pregnancy is ongoing', async () => {
    prisma.pregnancy.findFirst.mockResolvedValue({ id: 'preg-1' });
    prisma.patientCyclePeriod.findMany.mockResolvedValue([
      {
        id: 'p1',
        startDate: parseDateKey('2026-08-01'),
        endDate: parseDateKey('2026-08-05'),
      },
    ]);

    const result = await service.getCalendar(patientUser, {
      year: 2026,
      month: 9,
    });

    expect(result.pregnancyPaused).toBe(true);
    expect(result.predictedDays).toEqual([]);
    expect(result.headline).toBe('Tracking paused during pregnancy');
  });

  it('creates a period for the authenticated patient and auto-closes an open one', async () => {
    const open = {
      id: 'open-1',
      startDate: parseDateKey('2026-09-01'),
      endDate: null,
    };
    prisma.patientCyclePeriod.findMany.mockResolvedValue([open]);
    const created = {
      id: 'p2',
      startDate: parseDateKey('2026-09-08'),
      endDate: null,
      flow: null,
      notes: null,
      createdAt: new Date('2026-09-08T10:00:00Z'),
      updatedAt: new Date('2026-09-08T10:00:00Z'),
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        patientCycleSettings: { upsert: jest.fn() },
        patientCyclePeriod: {
          update: jest.fn(),
          create: jest.fn().mockResolvedValue(created),
        },
      };
      const result = await fn(tx);
      expect(tx.patientCyclePeriod.update).toHaveBeenCalledWith({
        where: { id: 'open-1' },
        data: { endDate: parseDateKey('2026-09-07') },
      });
      expect(tx.patientCyclePeriod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-uuid-1',
          startDate: parseDateKey('2026-09-08'),
        }),
      });
      return result;
    });

    const result = await service.createPeriod(patientUser, {
      startDate: '2026-09-08',
    });

    expect(result.id).toBe('p2');
    expect(result.startDate).toBe('2026-09-08');
  });

  it('throws 409 when a new period overlaps an existing range', async () => {
    prisma.patientCyclePeriod.findMany.mockResolvedValue([
      {
        id: 'p1',
        startDate: parseDateKey('2026-09-01'),
        endDate: parseDateKey('2026-09-05'),
      },
    ]);

    await expect(
      service.createPeriod(patientUser, { startDate: '2026-09-04' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws 404 for a period not owned by the patient', async () => {
    prisma.patientCyclePeriod.findFirst.mockResolvedValue(null);

    await expect(
      service.updatePeriod(patientUser, 'missing', { notes: 'cramps' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
