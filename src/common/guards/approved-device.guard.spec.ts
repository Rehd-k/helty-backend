import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatientDeviceStatus } from '@prisma/client';
import {
  ApprovedDeviceGuard,
  DEVICE_PENDING_APPROVAL,
} from '../../common/guards/approved-device.guard';
import { PrismaService } from '../../prisma/prisma.service';

function mockContext(user: Record<string, unknown> | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApprovedDeviceGuard', () => {
  const prisma = {
    patientDevice: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  let reflector: Reflector;
  let guard: ApprovedDeviceGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;
    guard = new ApprovedDeviceGuard(reflector, prisma);
  });

  it('skips non-patient users', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    await expect(
      guard.canActivate(
        mockContext({ accountType: 'FRONT_DESK', sub: 'staff-1' }),
      ),
    ).resolves.toBe(true);
  });

  it('allows PENDING when AllowPendingDevice is set', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'accountTypes') return ['PATIENT'];
      if (key === 'allowPendingDevice') return true;
      if (key === 'requireApprovedDevice') return false;
      return undefined;
    });
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'd1',
      patientId: 'p1',
      status: PatientDeviceStatus.PENDING,
    });

    await expect(
      guard.canActivate(
        mockContext({
          accountType: 'PATIENT',
          sub: 'p1',
          deviceId: 'd1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('blocks PENDING on protected routes with DEVICE_PENDING_APPROVAL', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'accountTypes') return ['PATIENT'];
      if (key === 'allowPendingDevice') return false;
      return undefined;
    });
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'd1',
      patientId: 'p1',
      status: PatientDeviceStatus.PENDING,
    });

    await expect(
      guard.canActivate(
        mockContext({
          accountType: 'PATIENT',
          sub: 'p1',
          deviceId: 'd1',
        }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: DEVICE_PENDING_APPROVAL }),
    });
  });

  it('allows APPROVED devices on protected routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'accountTypes') return ['PATIENT'];
      if (key === 'allowPendingDevice') return false;
      return undefined;
    });
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue({
      id: 'd1',
      patientId: 'p1',
      status: PatientDeviceStatus.APPROVED,
    });

    await expect(
      guard.canActivate(
        mockContext({
          accountType: 'PATIENT',
          sub: 'p1',
          deviceId: 'd1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects revoked devices', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'accountTypes') return ['PATIENT'];
      return false;
    });
    prisma.patientDevice.findUnique = jest.fn().mockResolvedValue(null);

    await expect(
      guard.canActivate(
        mockContext({
          accountType: 'PATIENT',
          sub: 'p1',
          deviceId: 'missing',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
