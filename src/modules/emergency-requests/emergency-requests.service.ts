import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EmergencyRequestStatus, Prisma } from '@prisma/client';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';
import { EmergencyRequestStorageService } from '../patient-emergency/emergency-request-storage.service';
import {
  ListStaffEmergencyRequestQueryDto,
  UpdateEmergencyRequestDto,
} from './dto/emergency-requests.dto';

const STAFF_INCLUDE = {
  patient: {
    select: {
      id: true,
      patientId: true,
      firstName: true,
      surname: true,
      otherName: true,
      phoneNumber: true,
      avatarUrl: true,
    },
  },
  respondedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmergencyRequestInclude;

const ALLOWED_TRANSITIONS: Record<
  EmergencyRequestStatus,
  EmergencyRequestStatus[]
> = {
  [EmergencyRequestStatus.SUBMITTED]: [
    EmergencyRequestStatus.ACKNOWLEDGED,
    EmergencyRequestStatus.CANCELLED,
  ],
  [EmergencyRequestStatus.ACKNOWLEDGED]: [
    EmergencyRequestStatus.DISPATCHED,
    EmergencyRequestStatus.CANCELLED,
  ],
  [EmergencyRequestStatus.DISPATCHED]: [
    EmergencyRequestStatus.CLOSED,
    EmergencyRequestStatus.CANCELLED,
  ],
  [EmergencyRequestStatus.CLOSED]: [],
  [EmergencyRequestStatus.CANCELLED]: [],
};

const STATUS_LABELS: Record<EmergencyRequestStatus, string> = {
  SUBMITTED: 'submitted',
  ACKNOWLEDGED: 'acknowledged by ED',
  DISPATCHED: 'ambulance dispatched',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

@Injectable()
export class EmergencyRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EmergencyRequestStorageService,
    private readonly fcm: FcmService,
  ) {}

  async list(query: ListStaffEmergencyRequestQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.EmergencyRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: STAFF_INCLUDE,
      }),
      this.prisma.emergencyRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(id: string) {
    const request = await this.prisma.emergencyRequest.findUnique({
      where: { id },
      include: STAFF_INCLUDE,
    });
    if (!request) {
      throw new NotFoundException(`Emergency request "${id}" not found.`);
    }
    return request;
  }

  async update(
    staffId: string,
    id: string,
    dto: UpdateEmergencyRequestDto,
  ) {
    const request = await this.get(id);
    const allowed = ALLOWED_TRANSITIONS[request.status];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition from ${request.status} to ${dto.status}.`,
      );
    }

    const now = new Date();
    const data: Prisma.EmergencyRequestUpdateInput = {
      status: dto.status,
      respondedBy: { connect: { id: staffId } },
      ...(dto.staffNote !== undefined
        ? { staffNote: dto.staffNote.trim() || null }
        : {}),
    };

    if (dto.status === EmergencyRequestStatus.ACKNOWLEDGED) {
      data.acknowledgedAt = now;
    } else if (dto.status === EmergencyRequestStatus.DISPATCHED) {
      data.dispatchedAt = now;
      if (!request.acknowledgedAt) {
        data.acknowledgedAt = now;
      }
    } else if (dto.status === EmergencyRequestStatus.CLOSED) {
      data.closedAt = now;
    } else if (dto.status === EmergencyRequestStatus.CANCELLED) {
      data.cancelledAt = now;
    }

    const updated = await this.prisma.emergencyRequest.update({
      where: { id },
      data,
      include: STAFF_INCLUDE,
    });

    void (updated.patientId
      ? this.fcm
          .sendToPatient(updated.patientId, {
            title: 'Emergency request update',
            body: `Your emergency request was ${STATUS_LABELS[updated.status]}.`,
            data: {
              type: 'EMERGENCY_REQUEST',
              emergencyRequestId: updated.id,
              status: updated.status,
            },
          })
          .catch(() => undefined)
      : undefined);

    return updated;
  }

  async streamMedia(id: string, kind: string): Promise<StreamableFile> {
    if (kind !== 'voice' && kind !== 'video') {
      throw new BadRequestException('kind must be voice or video');
    }
    const request = await this.get(id);
    const url = kind === 'voice' ? request.voiceUrl : request.videoUrl;
    if (!url) {
      throw new NotFoundException(`No ${kind} attached to this request.`);
    }
    const filePath = this.storage.resolvePath(id, url);
    const stream = createReadStream(filePath);
    const filename = basename(filePath);
    return new StreamableFile(stream, {
      type: this.storage.contentTypeForFilename(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }
}
