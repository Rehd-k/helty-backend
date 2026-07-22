import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientDeviceStatus } from '@prisma/client';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';
import { ListPatientDevicesQueryDto } from './dto/list-patient-devices-query.dto';

const DEVICE_SELECT = {
  id: true,
  deviceKey: true,
  platform: true,
  deviceLabel: true,
  status: true,
  approvedAt: true,
  approvedById: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      ...patientNameFieldsSelect,
      phoneNumber: true,
    },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true, staffId: true },
  },
} as const;

@Injectable()
export class FrontdeskPatientDeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  async listDevices(query: ListPatientDevicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            patient: {
              OR: [
                { patientId: { contains: search, mode: 'insensitive' as const } },
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { surname: { contains: search, mode: 'insensitive' as const } },
                { otherName: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.patientDevice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        select: DEVICE_SELECT,
      }),
      this.prisma.patientDevice.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toDeviceDto(row)),
      total,
      page,
      limit,
    };
  }

  async listDevicesForPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        ...patientNameFieldsSelect,
      },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const devices = await this.prisma.patientDevice.findMany({
      where: { patientId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: DEVICE_SELECT,
    });

    return {
      patient: {
        id: patient.id,
        patientId: patient.patientId,
        displayName: formatPatientDisplayName(patient),
        avatarUrl: patient.avatarUrl ?? null,
      },
      data: devices.map((row) => this.toDeviceDto(row)),
    };
  }

  async approveDevice(deviceId: string, staffId: string) {
    const device = await this.prisma.patientDevice.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        status: true,
        patientId: true,
        fcmToken: true,
        patient: {
          select: {
            ...patientNameFieldsSelect,
            patientId: true,
          },
        },
      },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    if (device.status === PatientDeviceStatus.APPROVED) {
      throw new BadRequestException('Device is already approved');
    }

    const updated = await this.prisma.patientDevice.update({
      where: { id: deviceId },
      data: {
        status: PatientDeviceStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: staffId,
      },
      select: DEVICE_SELECT,
    });

    const patientName = formatPatientDisplayName(device.patient);
    await this.fcm.sendToDevice(device.id, {
      title: 'Device approved',
      body: `Your device has been approved. You can now use the patient app.`,
      data: {
        type: 'DEVICE_APPROVED',
        deviceId: device.id,
        patientId: device.patientId,
      },
    });

    return {
      device: this.toDeviceDto(updated),
      message: `Device approved for ${patientName}`,
    };
  }

  async rejectDevice(deviceId: string) {
    const device = await this.prisma.patientDevice.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }
    await this.prisma.patientDevice.delete({ where: { id: deviceId } });
    return { removed: true };
  }

  private toDeviceDto(
    row: {
      id: string;
      deviceKey: string;
      platform: string | null;
      deviceLabel: string | null;
      status: PatientDeviceStatus;
      approvedAt: Date | null;
      approvedById: string | null;
      lastSeenAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      patient: {
        id: string;
        patientId: string | null;
        title?: string | null;
        firstName?: string | null;
        otherName?: string | null;
        surname?: string | null;
        avatarUrl?: string | null;
        phoneNumber?: string | null;
      };
      approvedBy: {
        id: string;
        firstName: string;
        lastName: string;
        staffId: string;
      } | null;
    },
  ) {
    return {
      id: row.id,
      deviceKey: row.deviceKey,
      platform: row.platform,
      deviceLabel: row.deviceLabel,
      status: row.status,
      approvedAt: row.approvedAt,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      patient: {
        id: row.patient.id,
        patientId: row.patient.patientId,
        displayName: formatPatientDisplayName(row.patient),
        avatarUrl: row.patient.avatarUrl ?? null,
        phoneNumber: row.patient.phoneNumber ?? null,
      },
      approvedBy: row.approvedBy
        ? {
            id: row.approvedBy.id,
            staffId: row.approvedBy.staffId,
            name: `${row.approvedBy.firstName} ${row.approvedBy.lastName}`.trim(),
          }
        : null,
    };
  }
}
