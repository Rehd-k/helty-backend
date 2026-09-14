import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientClinicalRecordsService } from './patient-clinical-records.service';

describe('PatientClinicalRecordsService', () => {
  const prisma = {
    patient: { findUnique: jest.fn() },
    patientAllergy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patientImmunization: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const service = new PatientClinicalRecordsService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an allergy for an existing patient', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.patientAllergy.create.mockResolvedValue({
      id: 'a1',
      allergen: 'Penicillin',
    });

    await service.createAllergy(
      'p1',
      { allergen: ' Penicillin ' },
      'staff-1',
    );

    expect(prisma.patientAllergy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'p1',
          allergen: 'Penicillin',
          createdById: 'staff-1',
        }),
      }),
    );
  });

  it('throws when creating an allergy for a missing patient', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(
      service.createAllergy('missing', { allergen: 'Peanuts' }, 'staff-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates and deletes an allergy', async () => {
    prisma.patientAllergy.findFirst.mockResolvedValue({ id: 'a1' });
    prisma.patientAllergy.update.mockResolvedValue({ id: 'a1' });
    prisma.patientAllergy.delete.mockResolvedValue({ id: 'a1' });

    await service.updateAllergy(
      'p1',
      'a1',
      { severity: 'SEVERE' },
      'staff-2',
    );
    expect(prisma.patientAllergy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: 'SEVERE',
          updatedById: 'staff-2',
        }),
      }),
    );

    await service.removeAllergy('p1', 'a1');
    expect(prisma.patientAllergy.delete).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
  });

  it('creates an immunization', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.patientImmunization.create.mockResolvedValue({ id: 'i1' });

    await service.createImmunization(
      'p1',
      {
        vaccineName: 'TT',
        administeredAt: '2026-03-12T10:00:00.000Z',
        doseNumber: 1,
      },
      'staff-1',
    );

    expect(prisma.patientImmunization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vaccineName: 'TT',
          doseNumber: 1,
          createdById: 'staff-1',
        }),
      }),
    );
  });

  it('updates and deletes an immunization', async () => {
    prisma.patientImmunization.findFirst.mockResolvedValue({ id: 'i1' });
    prisma.patientImmunization.update.mockResolvedValue({ id: 'i1' });
    prisma.patientImmunization.delete.mockResolvedValue({ id: 'i1' });

    await service.updateImmunization(
      'p1',
      'i1',
      { detail: 'Booster' },
      'staff-2',
    );
    expect(prisma.patientImmunization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detail: 'Booster',
          updatedById: 'staff-2',
        }),
      }),
    );

    await service.removeImmunization('p1', 'i1');
    expect(prisma.patientImmunization.delete).toHaveBeenCalledWith({
      where: { id: 'i1' },
    });
  });
});
