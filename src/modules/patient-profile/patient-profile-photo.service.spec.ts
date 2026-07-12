import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PatientStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientPhotoStorageService } from './patient-photo-storage.service';
import { PatientProfilePhotoService } from './patient-profile-photo.service';

describe('PatientProfilePhotoService', () => {
  const prisma = {
    patient: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const photoStorage = {
    processAndSave: jest.fn(),
    deleteIfExists: jest.fn(),
  } as unknown as PatientPhotoStorageService;

  const service = new PatientProfilePhotoService(prisma, photoStorage);

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
    avatarUrl: null,
    status: PatientStatus.OUTPATIENT,
    hmoProvider: { name: 'Test HMO' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads photo and returns updated patient DTO', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(patientRecord);
    photoStorage.processAndSave = jest
      .fn()
      .mockResolvedValue('http://localhost:4000/uploads/patients/uuid-1/avatar.jpg');
    prisma.patient.update = jest.fn().mockResolvedValue({
      ...patientRecord,
      avatarUrl: 'http://localhost:4000/uploads/patients/uuid-1/avatar.jpg',
    });

    const file = {
      buffer: Buffer.from('jpeg'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const result = await service.uploadPhoto(user, file);

    expect(photoStorage.processAndSave).toHaveBeenCalledWith(
      'uuid-1',
      file.buffer,
    );
    expect(result.avatarUrl).toBe(
      'http://localhost:4000/uploads/patients/uuid-1/avatar.jpg',
    );
  });

  it('deletes previous photo before replace', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue({
      ...patientRecord,
      avatarUrl: 'http://localhost:4000/uploads/patients/uuid-1/avatar.jpg',
    });
    photoStorage.processAndSave = jest
      .fn()
      .mockResolvedValue('http://localhost:4000/uploads/patients/uuid-1/avatar.jpg');
    prisma.patient.update = jest.fn().mockResolvedValue({
      ...patientRecord,
      avatarUrl: 'http://localhost:4000/uploads/patients/uuid-1/avatar.jpg',
    });

    await service.uploadPhoto(user, {
      buffer: Buffer.from('jpeg'),
    } as Express.Multer.File);

    expect(photoStorage.deleteIfExists).toHaveBeenCalledWith('uuid-1');
  });

  it('rejects missing file', async () => {
    await expect(service.uploadPhoto(user, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects staff token on upload', async () => {
    await expect(
      service.uploadPhoto(
        { ...user, accountType: 'STAFF' as never },
        { buffer: Buffer.from('x') } as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes photo and clears avatarUrl', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue({
      ...patientRecord,
      avatarUrl: 'http://localhost:4000/uploads/patients/uuid-1/avatar.jpg',
    });
    prisma.patient.update = jest.fn().mockResolvedValue({
      ...patientRecord,
      avatarUrl: null,
    });

    const result = await service.deletePhoto(user);

    expect(photoStorage.deleteIfExists).toHaveBeenCalledWith('uuid-1');
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { avatarUrl: null },
      select: expect.any(Object),
    });
    expect(result.avatarUrl).toBeNull();
  });

  it('idempotent delete when no photo exists', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(patientRecord);
    prisma.patient.update = jest.fn().mockResolvedValue(patientRecord);

    const result = await service.deletePhoto(user);

    expect(photoStorage.deleteIfExists).toHaveBeenCalledWith('uuid-1');
    expect(result.avatarUrl).toBeNull();
  });

  it('throws NotFoundException when patient missing', async () => {
    prisma.patient.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      service.deletePhoto(user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
