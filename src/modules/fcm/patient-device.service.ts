import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientDeviceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isDeviceVerificationExempt } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { UpdateCurrentFcmTokenDto } from './dto/update-current-fcm-token.dto';

const DEVICE_LIST_SELECT = {
  id: true,
  deviceKey: true,
  platform: true,
  deviceLabel: true,
  status: true,
  approvedAt: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PatientDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPatient(user: PatientJwtPayload) {
    const devices = await this.prisma.patientDevice.findMany({
      where: { patientId: user.sub },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: DEVICE_LIST_SELECT,
    });

    return {
      data: devices.map((d) => ({
        ...d,
        isCurrent: d.id === user.deviceId,
      })),
    };
  }

  async getCurrentStatus(user: PatientJwtPayload) {
    const device = await this.prisma.patientDevice.findFirst({
      where: { id: user.deviceId, patientId: user.sub },
      select: DEVICE_LIST_SELECT,
    });
    if (!device) {
      throw new NotFoundException('Current device not found');
    }

    if (
      device.status !== PatientDeviceStatus.APPROVED &&
      isDeviceVerificationExempt(user.patientId)
    ) {
      const approved = await this.prisma.patientDevice.update({
        where: { id: device.id },
        data: {
          status: PatientDeviceStatus.APPROVED,
          approvedAt: device.approvedAt ?? new Date(),
        },
        select: DEVICE_LIST_SELECT,
      });
      return { device: approved, isCurrent: true };
    }

    return { device, isCurrent: true };
  }

  async updateCurrentFcmToken(
    user: PatientJwtPayload,
    dto: UpdateCurrentFcmTokenDto,
  ) {
    const token = dto.token.trim();
    const platform = dto.platform?.trim() || null;

    const device = await this.prisma.patientDevice.findFirst({
      where: { id: user.deviceId, patientId: user.sub },
    });
    if (!device) {
      throw new NotFoundException('Current device not found');
    }

    const tokenOwner = await this.prisma.patientDevice.findUnique({
      where: { fcmToken: token },
      select: { id: true },
    });
    if (tokenOwner && tokenOwner.id !== device.id) {
      await this.prisma.patientDevice.update({
        where: { id: tokenOwner.id },
        data: { fcmToken: null },
      });
    }

    const updated = await this.prisma.patientDevice.update({
      where: { id: device.id },
      data: {
        fcmToken: token,
        ...(platform ? { platform } : {}),
        lastSeenAt: new Date(),
      },
      select: DEVICE_LIST_SELECT,
    });

    return { device: updated };
  }

  async removeDevice(user: PatientJwtPayload, deviceId: string) {
    const device = await this.prisma.patientDevice.findFirst({
      where: { id: deviceId, patientId: user.sub },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.patientDevice.delete({ where: { id: device.id } });
    return {
      removed: true,
      wasCurrent: device.id === user.deviceId,
    };
  }
}
