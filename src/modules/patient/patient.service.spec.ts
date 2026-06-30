import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus, Prisma } from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: () => 'TESTIDAB',
}));

import { PatientService } from './patient.service';

describe('PatientService.update', () => {
  const staffId = 'staff-1';
  const patientId = 'patient-uuid-1';
  const req = { user: { sub: staffId } };

  const prisma = {
    staff: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn(), update: jest.fn() },
    hmo: { findUnique: jest.fn() },
    ward: { findUnique: jest.fn() },
  };

  let service: PatientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientService(prisma as any);
    prisma.staff.findUnique.mockResolvedValue({ id: staffId });
    prisma.patient.findUnique.mockResolvedValue({
      id: patientId,
      patientId: 'O89UVJ9X',
    });
    prisma.patient.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: patientId, ...data }),
    );
  });

  it('persists demographic fields including title, cardNo, and gender', async () => {
    await service.update(
      patientId,
      {
        title: 'Master',
        cardNo: '1234524',
        gender: 'Male',
        nationality: 'Nigeria',
        stateOfOrigin: 'Delta',
      },
      req,
    );

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: patientId },
      data: expect.objectContaining({
        title: 'Master',
        cardNo: '1234524',
        gender: 'Male',
        nationality: 'Nigeria',
        stateOfOrigin: 'Delta',
        updatedBy: { connect: { id: staffId } },
      }),
    });
  });

  it('converts dob string to Date in the Prisma payload', async () => {
    await service.update(
      patientId,
      { dob: '2017-03-14T00:00:00.000Z' },
      req,
    );

    const call = prisma.patient.update.mock.calls[0][0];
    expect(call.data.dob).toBeInstanceOf(Date);
    expect(call.data.dob.toISOString()).toBe('2017-03-14T00:00:00.000Z');
  });

  it('connects hmoId and syncs legacy hmo text from provider name', async () => {
    const hmoUuid = 'hmo-uuid-1';
    prisma.hmo.findUnique.mockResolvedValue({
      id: hmoUuid,
      name: 'Test HMO',
    });

    await service.update(patientId, { hmoId: hmoUuid }, req);

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: patientId },
      data: expect.objectContaining({
        hmoProvider: { connect: { id: hmoUuid } },
        hmo: 'Test HMO',
      }),
    });
  });

  it('connects wardId and sets OUTPATIENT status for OPD ward', async () => {
    const wardUuid = 'ward-opd-1';
    prisma.ward.findUnique.mockResolvedValue({ id: wardUuid, name: 'OPD' });

    await service.update(patientId, { wardId: wardUuid }, req);

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: patientId },
      data: expect.objectContaining({
        ward: { connect: { id: wardUuid } },
        status: PatientStatus.OUTPATIENT,
      }),
    });
  });

  it('does not pass read-only keys like createdAt into Prisma data', async () => {
    await service.update(
      patientId,
      {
        surname: 'Updated',
        createdAt: '2026-03-14T07:58:11.162Z',
        createdBy: 'some staff',
      } as any,
      req,
    );

    const call = prisma.patient.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('createdAt');
    expect(call.data).not.toHaveProperty('createdBy');
    expect(call.data.surname).toBe('Updated');
  });

  it('throws NotFoundException when patient does not exist', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);

    await expect(
      service.update(patientId, { surname: 'Test' }, req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PatientService.remove', () => {
  const prisma = {
    patient: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: PatientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientService(prisma as any);
  });

  it('throws NotFoundException when patient does not exist', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes patient when no linked records block removal', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.patient.delete.mockResolvedValue({ id: 'p-1' });

    await service.remove('p-1');

    expect(prisma.patient.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
  });

  it('throws ConflictException when foreign key constraints block delete', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.patient.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('p-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
