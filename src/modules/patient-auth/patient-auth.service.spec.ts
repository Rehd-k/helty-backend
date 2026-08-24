import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientDeviceStatus, PatientStatus } from '@prisma/client';
import { PatientAuthService } from './patient-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PatientAuthService', () => {
  const prisma = {
    patient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    patientDevice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
    avatarUrl: null,
    status: PatientStatus.OUTPATIENT,
    hmoProvider: { name: 'Test HMO' },
  };

  const pendingDevice = {
    id: 'device-1',
    deviceKey: 'key-1',
    platform: 'android',
    deviceLabel: 'Phone',
    status: PatientDeviceStatus.PENDING,
    approvedAt: null,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates PENDING device and returns token on first login', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(null);
    prisma.patientDevice.create = jest.fn().mockResolvedValue(pendingDevice);

    const result = await service.login({
      patientId: 'ab12cd34',
      dob: '1990-05-15',
      deviceKey: 'key-1',
      platform: 'android',
      deviceLabel: 'Phone',
    });

    expect(prisma.patientDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'uuid-1',
          deviceKey: 'key-1',
          status: PatientDeviceStatus.PENDING,
        }),
      }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'uuid-1',
      patientId: 'AB12CD34',
      accountType: 'PATIENT',
      deviceId: 'device-1',
    });
    expect(result.accessToken).toBe('signed-token');
    expect(result.device.status).toBe(PatientDeviceStatus.PENDING);
  });

  it('reuses APPROVED device without changing status', async () => {
    const approved = {
      ...pendingDevice,
      status: PatientDeviceStatus.APPROVED,
      approvedAt: new Date(),
    };
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);
    prisma.patientDevice.findUnique = jest.fn().mockImplementation(({ where }) => {
      if (where.deviceKey) {
        return Promise.resolve({
          ...approved,
          patientId: 'uuid-1',
          fcmToken: null,
        });
      }
      return Promise.resolve(null);
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue(approved);

    const result = await service.login({
      patientId: 'AB12CD34',
      dob: '1990-05-15',
      deviceKey: 'key-1',
    });

    expect(prisma.patientDevice.create).not.toHaveBeenCalled();
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });

  it('reassigns device owned by another patient to PENDING', async () => {
    const reassigned = {
      ...pendingDevice,
      status: PatientDeviceStatus.PENDING,
      approvedAt: null,
    };
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);
    prisma.patientDevice.findUnique = jest.fn().mockImplementation(({ where }) => {
      if (where.deviceKey) {
        return Promise.resolve({
          id: 'device-x',
          patientId: 'other-patient',
          deviceKey: 'key-1',
          status: PatientDeviceStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: 'staff-1',
          fcmToken: null,
        });
      }
      return Promise.resolve(null);
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue(reassigned);

    const result = await service.login({
      patientId: 'AB12CD34',
      dob: '1990-05-15',
      deviceKey: 'key-1',
      platform: 'ios',
      deviceLabel: 'New Phone',
    });

    expect(prisma.patientDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-x' },
        data: expect.objectContaining({
          patientId: 'uuid-1',
          status: PatientDeviceStatus.PENDING,
          approvedAt: null,
          approvedById: null,
          platform: 'ios',
          deviceLabel: 'New Phone',
        }),
      }),
    );
    expect(result.device.status).toBe(PatientDeviceStatus.PENDING);
  });

  it('rejects unknown patient ID', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.login({
        patientId: 'UNKNOWN',
        dob: '1990-05-15',
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong date of birth', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue(patientRecord);

    await expect(
      service.login({
        patientId: 'AB12CD34',
        dob: '1991-01-01',
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects deceased patients', async () => {
    prisma.patient.findFirst = jest.fn().mockResolvedValue({
      ...patientRecord,
      status: PatientStatus.DECEASED,
    });

    await expect(
      service.login({
        patientId: 'AB12CD34',
        dob: '1990-05-15',
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logout deletes the current device', async () => {
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'device-1',
      patientId: 'uuid-1',
    });
    prisma.patientDevice.delete = jest.fn().mockResolvedValue({});

    await service.logout({
      sub: 'uuid-1',
      patientId: 'AB12CD34',
      accountType: 'PATIENT',
      deviceId: 'device-1',
    });

    expect(prisma.patientDevice.delete).toHaveBeenCalledWith({
      where: { id: 'device-1' },
    });
  });

  it('auto-approves devices for the exempt test patient', async () => {
    const testPatient = {
      ...patientRecord,
      id: 'uuid-test',
      patientId: 'Q4CMEZM8',
    };
    const approvedDevice = {
      ...pendingDevice,
      status: PatientDeviceStatus.APPROVED,
      approvedAt: new Date(),
    };
    prisma.patient.findFirst = jest.fn().mockResolvedValue(testPatient);
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(null);
    prisma.patientDevice.create = jest.fn().mockResolvedValue(approvedDevice);

    const result = await service.login({
      patientId: 'q4cmezm8',
      dob: '1990-05-15',
      deviceKey: 'key-test',
      platform: 'android',
      deviceLabel: 'Test Phone',
    });

    expect(prisma.patientDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'uuid-test',
          deviceKey: 'key-test',
          status: PatientDeviceStatus.APPROVED,
          approvedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });

  it('upgrades an existing pending device for the exempt test patient', async () => {
    const testPatient = {
      ...patientRecord,
      id: 'uuid-test',
      patientId: 'Q4CMEZM8',
    };
    const approvedDevice = {
      ...pendingDevice,
      status: PatientDeviceStatus.APPROVED,
      approvedAt: new Date(),
    };
    prisma.patient.findFirst = jest.fn().mockResolvedValue(testPatient);
    prisma.patientDevice.findUnique = jest.fn().mockImplementation(({ where }) => {
      if (where.deviceKey) {
        return Promise.resolve({
          ...pendingDevice,
          patientId: 'uuid-test',
          fcmToken: null,
        });
      }
      return Promise.resolve(null);
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue(approvedDevice);

    const result = await service.login({
      patientId: 'Q4CMEZM8',
      dob: '1990-05-15',
      deviceKey: 'key-1',
    });

    expect(prisma.patientDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PatientDeviceStatus.APPROVED,
          approvedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });

  it('auto-approves a pending device when the exempt test patient restores a session', async () => {
    const testPatient = {
      ...patientRecord,
      id: 'uuid-test',
      patientId: 'Q4CMEZM8',
    };
    prisma.patient.findUnique = jest.fn().mockResolvedValue(testPatient);
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(pendingDevice);
    prisma.patientDevice.update = jest.fn().mockResolvedValue({
      ...pendingDevice,
      status: PatientDeviceStatus.APPROVED,
      approvedAt: new Date(),
    });

    const result = await service.getMe({
      sub: 'uuid-test',
      patientId: 'Q4CMEZM8',
      accountType: 'PATIENT',
      deviceId: 'device-1',
    });

    expect(prisma.patientDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-1' },
        data: expect.objectContaining({
          status: PatientDeviceStatus.APPROVED,
        }),
      }),
    );
    expect(result.device?.status).toBe(PatientDeviceStatus.APPROVED);
  });
});
