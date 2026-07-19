import { PatientDeviceStatus } from '@prisma/client';
import { FrontdeskPatientDeviceService } from './frontdesk-patient-device.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';

describe('FrontdeskPatientDeviceService.approveDevice', () => {
  const prisma = {
    patientDevice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const fcm = {
    sendToDevice: jest.fn().mockResolvedValue({ status: 'SENT', provider: 'fcm' }),
  } as unknown as FcmService;

  const service = new FrontdeskPatientDeviceService(prisma, fcm);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves pending device and sends DEVICE_APPROVED push', async () => {
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'device-1',
      status: PatientDeviceStatus.PENDING,
      patientId: 'patient-1',
      fcmToken: 'token',
      patient: {
        patientId: 'AB12',
        firstName: 'Ada',
        surname: 'Lovelace',
        title: null,
        otherName: null,
        avatarUrl: null,
      },
    });
    prisma.patientDevice.update = jest.fn().mockResolvedValue({
      id: 'device-1',
      deviceKey: 'key',
      platform: 'ios',
      deviceLabel: 'iPhone',
      status: PatientDeviceStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: 'staff-1',
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: {
        id: 'patient-1',
        patientId: 'AB12',
        firstName: 'Ada',
        surname: 'Lovelace',
        title: null,
        otherName: null,
        avatarUrl: null,
        phoneNumber: null,
      },
      approvedBy: {
        id: 'staff-1',
        firstName: 'Front',
        lastName: 'Desk',
        staffId: 'FD1',
      },
    });

    const result = await service.approveDevice('device-1', 'staff-1');

    expect(prisma.patientDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PatientDeviceStatus.APPROVED,
          approvedById: 'staff-1',
        }),
      }),
    );
    expect(fcm.sendToDevice).toHaveBeenCalledWith(
      'device-1',
      expect.objectContaining({
        data: expect.objectContaining({ type: 'DEVICE_APPROVED' }),
      }),
    );
    expect(result.device.status).toBe(PatientDeviceStatus.APPROVED);
  });
});
