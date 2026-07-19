import { ForbiddenException } from '@nestjs/common';
import { PatientFamilyService } from './patient-family.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PatientFamilyService', () => {
  const prisma = {
    patientFamilyLink: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new PatientFamilyService(prisma);

  const user = {
    sub: 'parent-1',
    patientId: 'P1',
    accountType: 'PATIENT' as const,
    deviceId: 'd1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves self when forPatientId omitted', async () => {
    await expect(service.resolveSubjectPatientId(user)).resolves.toBe(
      'parent-1',
    );
  });

  it('allows linked child', async () => {
    prisma.patientFamilyLink.findUnique = jest.fn().mockResolvedValue({
      id: 'link-1',
    });

    await expect(
      service.resolveSubjectPatientId(user, 'child-1'),
    ).resolves.toBe('child-1');
  });

  it('denies unlinked patient', async () => {
    prisma.patientFamilyLink.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.resolveSubjectPatientId(user, 'stranger'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
