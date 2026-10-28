import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientDeviceStatus, PatientPortalOtpPurpose, PatientStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PatientAuthService } from './patient-auth.service';
import { PatientOtpDeliveryService } from './patient-otp-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PatientAuthService', () => {
  const prisma = {
    patient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patientDevice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patientPortalOtp: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as unknown as JwtService;

  const otpDelivery = {
    channels: jest.fn().mockReturnValue(new Set(['staff'])),
    mode: jest.fn().mockReturnValue('staff'),
    deliver: jest.fn().mockResolvedValue('staff'),
  } as unknown as PatientOtpDeliveryService;

  const service = new PatientAuthService(prisma, jwtService, otpDelivery);

  const password = 'password12';
  let passwordHash = '';

  const patientRecord = () => ({
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
    phoneNumber: '08030000000',
    addressOfResidence: 'Lagos',
    hmo: null,
    avatarUrl: null,
    status: PatientStatus.OUTPATIENT,
    hmoProvider: { name: 'Test HMO' },
    password: passwordHash,
    portalActivatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const approvedDevice = {
    id: 'device-1',
    deviceKey: 'key-1',
    platform: 'android',
    deviceLabel: 'Phone',
    status: PatientDeviceStatus.APPROVED,
    approvedAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (otpDelivery.channels as jest.Mock).mockReturnValue(new Set(['staff']));
    (otpDelivery.mode as jest.Mock).mockReturnValue('staff');
    (otpDelivery.deliver as jest.Mock).mockResolvedValue('staff');
    prisma.$transaction = jest.fn(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    ) as unknown as PrismaService['$transaction'];
  });

  it('signs in with phone and password and approves the device', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([patientRecord()]);
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(null);
    prisma.patientDevice.create = jest.fn().mockResolvedValue(approvedDevice);
    prisma.patientDevice.update = jest.fn().mockResolvedValue(approvedDevice);

    const result = await service.login({
      phoneNumber: '+234 803 000 0000',
      password,
      deviceKey: 'key-1',
      platform: 'android',
      deviceLabel: 'Phone',
    });

    expect(prisma.patientDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'uuid-1',
          deviceKey: 'key-1',
          status: PatientDeviceStatus.APPROVED,
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
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.patient).not.toHaveProperty('password');
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });

  it('moves a device onto the signing-in patient as approved', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([patientRecord()]);
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
          refreshTokenHash: 'old',
        });
      }
      return Promise.resolve(null);
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue(approvedDevice);

    await service.login({
      phoneNumber: '08030000000',
      password,
      deviceKey: 'key-1',
    });

    expect(prisma.patientDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-x' },
        data: expect.objectContaining({
          patientId: 'uuid-1',
          status: PatientDeviceStatus.APPROVED,
          approvedById: null,
          refreshTokenHash: null,
        }),
      }),
    );
  });

  it('rejects an unknown phone number', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([]);

    await expect(
      service.login({
        phoneNumber: '08031111111',
        password,
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a wrong password', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([patientRecord()]);

    await expect(
      service.login({
        phoneNumber: '08030000000',
        password: 'not-the-password',
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects deceased patients', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([
      { ...patientRecord(), status: PatientStatus.DECEASED },
    ]);

    await expect(
      service.login({
        phoneNumber: '08030000000',
        password,
        deviceKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tells an unactivated patient to activate', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([
      { ...patientRecord(), password: null, portalActivatedAt: null },
    ]);

    await expect(
      service.login({
        phoneNumber: '08030000000',
        password,
        deviceKey: 'key-1',
      }),
    ).rejects.toThrow('not activated');
  });

  it('fails activation when the phone and date of birth do not match', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([patientRecord()]);

    await expect(
      service.requestActivation({
        phoneNumber: '08030000000',
        dob: '1991-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(otpDelivery.deliver).not.toHaveBeenCalled();
  });

  it('refuses activation when a password is already set', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([patientRecord()]);

    await expect(
      service.requestActivation({
        phoneNumber: '08030000000',
        dob: '1990-05-15',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('issues an activation code without calling Termii on the staff channel', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([
      { ...patientRecord(), password: null, portalActivatedAt: null },
    ]);
    prisma.patientPortalOtp.count = jest.fn().mockResolvedValue(0);
    prisma.patientPortalOtp.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.patientPortalOtp.create = jest.fn().mockResolvedValue({ id: 'otp-1' });

    const result = await service.requestActivation({
      phoneNumber: '08030000000',
      dob: '1990-05-15',
    });

    expect(result.delivery).toBe('staff');
    expect(otpDelivery.deliver).toHaveBeenCalledWith(
      '08030000000',
      expect.stringMatching(/^\d{6}$/),
    );
    expect(prisma.patientPortalOtp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'uuid-1',
          purpose: PatientPortalOtpPurpose.ACTIVATION,
        }),
      }),
    );
  });

  it('burns a code after five wrong tries', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([
      { ...patientRecord(), password: null },
    ]);
    prisma.patientPortalOtp.findFirst = jest.fn().mockResolvedValue({
      id: 'otp-1',
      code: '111111',
      attempts: 4,
    });
    prisma.patientPortalOtp.update = jest.fn().mockResolvedValue({});

    await expect(
      service.verifyActivation({ phoneNumber: '08030000000', code: '000000' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.patientPortalOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-1' },
        data: expect.objectContaining({ attempts: 5, usedAt: expect.any(Date) }),
      }),
    );
  });

  it('returns a setup token for a matching activation code', async () => {
    prisma.patient.findMany = jest.fn().mockResolvedValue([
      { ...patientRecord(), password: null },
    ]);
    prisma.patientPortalOtp.findFirst = jest.fn().mockResolvedValue({
      id: 'otp-1',
      code: '123456',
      attempts: 0,
    });
    prisma.patientPortalOtp.update = jest.fn().mockResolvedValue({});

    const result = await service.verifyActivation({
      phoneNumber: '08030000000',
      code: '123456',
    });

    expect(result.setupToken).toEqual(expect.any(String));
    expect(prisma.patientPortalOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          setupTokenHash: expect.any(String),
          setupTokenExpiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('sets the password and opens a session', async () => {
    const fresh = { ...patientRecord(), password: null, portalActivatedAt: null };
    prisma.patientPortalOtp.findFirst = jest.fn().mockResolvedValue({
      id: 'otp-1',
      patientId: 'uuid-1',
    });
    prisma.patient.findUnique = jest.fn().mockResolvedValue(fresh);
    prisma.patient.update = jest.fn().mockResolvedValue(fresh);
    prisma.patientPortalOtp.update = jest.fn().mockResolvedValue({});
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(null);
    prisma.patientDevice.create = jest.fn().mockResolvedValue(approvedDevice);
    prisma.patientDevice.update = jest.fn().mockResolvedValue(approvedDevice);

    const result = await service.completeActivation({
      setupToken: 'setup-token',
      password,
      deviceKey: 'key-1',
    });

    expect(prisma.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uuid-1' },
        data: expect.objectContaining({
          password: expect.any(String),
          portalActivatedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.accessToken).toBe('signed-token');
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });

  it('logout clears the refresh token and keeps the device', async () => {
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'device-1',
      patientId: 'uuid-1',
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue({});

    await service.logout({
      sub: 'uuid-1',
      patientId: 'AB12CD34',
      accountType: 'PATIENT',
      deviceId: 'device-1',
    });

    expect(prisma.patientDevice.delete).not.toHaveBeenCalled();
    expect(prisma.patientDevice.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  });

  it('rejects a refresh token that does not match', async () => {
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'device-1',
      patientId: 'uuid-1',
      deviceKey: 'key-1',
      status: PatientDeviceStatus.APPROVED,
      refreshTokenHash: 'not-the-hash',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.refresh({ refreshToken: 'plain-token', deviceKey: 'key-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hides the code from staff when delivery is phone only', async () => {
    (otpDelivery.channels as jest.Mock).mockReturnValue(new Set(['sms', 'whatsapp']));
    (otpDelivery.mode as jest.Mock).mockReturnValue('phone');
    prisma.patientPortalOtp.findMany = jest.fn().mockResolvedValue([
      {
        id: 'otp-1',
        purpose: PatientPortalOtpPurpose.ACTIVATION,
        code: '123456',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        patient: {
          patientId: 'AB12CD34',
          firstName: 'John',
          otherName: null,
          surname: 'Doe',
          phoneNumber: '08030000000',
        },
      },
    ]);

    const result = await service.listLoginCodes();

    expect(result.delivery).toBe('phone');
    expect(result.data[0].code).toBeNull();
    expect(result.data[0].sentToPhone).toBe(true);
    expect(result.data[0].patientName).toBe('John Doe');
  });

  it('auto-approves a pending device when the exempt test patient restores a session', async () => {
    const pendingDevice = {
      ...approvedDevice,
      status: PatientDeviceStatus.PENDING,
      approvedAt: null,
    };
    prisma.patient.findUnique = jest.fn().mockResolvedValue({
      ...patientRecord(),
      id: 'uuid-test',
      patientId: 'Q4CMEZM8',
    });
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

    expect(result.device?.status).toBe(PatientDeviceStatus.APPROVED);
  });
});
