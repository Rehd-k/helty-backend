import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientProfileService } from './patient-profile.service';

describe('PatientProfileService', () => {
  const prisma = {
    patient: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new PatientProfileService(prisma);

  const user = {
    sub: 'uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT' as const,
  };

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

  it('returns flat profile DTO on GET', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(patientRecord);

    const result = await service.getProfile(user);

    expect(result).toEqual({
      id: 'uuid-1',
      patientId: 'AB12CD34',
      cardNo: 'CARD1',
      title: 'Mr',
      surname: 'Doe',
      firstName: 'John',
      otherName: null,
      dob: patientRecord.dob,
      gender: 'Male',
      email: 'john@example.com',
      phoneNumber: '08000000000',
      addressOfResidence: 'Lagos',
      hmo: 'Test HMO',
    });
    expect(result).not.toHaveProperty('patient');
  });

  it('throws NotFoundException when patient is missing', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.getProfile(user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects empty PUT body', async () => {
    await expect(service.updateProfile(user, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects deceased patient update', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue({
      ...patientRecord,
      status: PatientStatus.DECEASED,
    });

    await expect(
      service.updateProfile(user, { email: 'new@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates only provided contact fields', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(patientRecord);
    prisma.patient.update = jest.fn().mockResolvedValue({
      ...patientRecord,
      email: 'new@example.com',
    });

    const result = await service.updateProfile(user, {
      email: 'new@example.com',
    });

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { email: 'new@example.com' },
      select: expect.any(Object),
    });
    expect(result.email).toBe('new@example.com');
    expect(result.phoneNumber).toBe('08000000000');
  });
});
