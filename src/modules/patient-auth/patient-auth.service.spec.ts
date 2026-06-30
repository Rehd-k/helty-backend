import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientStatus } from '@prisma/client';
import { PatientAuthService } from './patient-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PatientAuthService', () => {
  const prisma = {
    patient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as unknown as JwtService;

  const service = new PatientAuthService(prisma, jwtService);

  const patientRecord = {
    id: 'uuid-1',
    patientId: 'AB12CD34',
    cardNo: 'CARD1',
    title: 'Mr',
    surname: 'Doe',
    firstName: 'John',
    otherName: null,
    dob: new Date('1990-05-15T00:00:00.000Z'),
    gender: 'Male',
    email: 'john@example.com',
    phoneNumber: '08000000000',
    addressOfResidence: 'Lagos',
    hmo: null,
    status: PatientStatus.OUTPATIENT,
    hmoProvider: { name: 'Test HMO' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns token and patient on valid credentials', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);

    const result = await service.login({
      patientId: 'ab12cd34',
      dob: '1990-05-15',
    });

    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { patientId: { equals: 'ab12cd34', mode: 'insensitive' } },
      select: expect.any(Object),
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'uuid-1',
      patientId: 'AB12CD34',
      accountType: 'PATIENT',
    });
    expect(result.accessToken).toBe('signed-token');
    expect(result.patient.hmo).toBe('Test HMO');
  });

  it('rejects unknown patient ID', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.login({ patientId: 'UNKNOWN', dob: '1990-05-15' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong date of birth', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);

    await expect(
      service.login({ patientId: 'AB12CD34', dob: '1991-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects deceased patients', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue({
      ...patientRecord,
      status: PatientStatus.DECEASED,
    });

    await expect(
      service.login({ patientId: 'AB12CD34', dob: '1990-05-15' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
