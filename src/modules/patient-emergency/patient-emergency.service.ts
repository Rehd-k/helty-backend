import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmergencyRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreateEmergencyRequestDto,
  ListEmergencyRequestQueryDto,
} from './dto/patient-emergency.dto';
import { EmergencyRequestStorageService } from './emergency-request-storage.service';
import { randomUUID } from 'crypto';

const PATIENT_INCLUDE = {
  respondedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmergencyRequestInclude;

@Injectable()
export class PatientEmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EmergencyRequestStorageService,
  ) {}

  async create(
    user: PatientJwtPayload,
    dto: CreateEmergencyRequestDto,
    files: { voice?: Express.Multer.File; video?: Express.Multer.File },
  ) {
    const description = dto.description?.trim() || null;
    const hasText = !!description;
    const hasVoice = !!files.voice?.buffer?.length;
    const hasVideo = !!files.video?.buffer?.length;

    if (!hasText && !hasVoice && !hasVideo) {
      throw new BadRequestException(
        'Provide at least one of: description text, voice note, or video.',
      );
    }

    if (
      typeof dto.latitude !== 'number' ||
      Number.isNaN(dto.latitude) ||
      typeof dto.longitude !== 'number' ||
      Number.isNaN(dto.longitude)
    ) {
      throw new BadRequestException('Valid latitude and longitude are required.');
    }

    const requestId = randomUUID();
    let voiceUrl: string | null = null;
    let videoUrl: string | null = null;

    try {
      if (hasVoice && files.voice) {
        voiceUrl = this.storage.saveFile(requestId, 'voice', files.voice);
      }
      if (hasVideo && files.video) {
        videoUrl = this.storage.saveFile(requestId, 'video', files.video);
      }

      return await this.prisma.emergencyRequest.create({
        data: {
          id: requestId,
          patientId: user.sub,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          addressText: dto.addressText?.trim() || null,
          description,
          voiceUrl,
          videoUrl,
        },
        include: PATIENT_INCLUDE,
      });
    } catch (err) {
      this.storage.deleteRequestDir(requestId);
      throw err;
    }
  }

  async list(user: PatientJwtPayload, query: ListEmergencyRequestQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.EmergencyRequestWhereInput = {
      patientId: user.sub,
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PATIENT_INCLUDE,
      }),
      this.prisma.emergencyRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(user: PatientJwtPayload, id: string) {
    return this.findOwned(user.sub, id);
  }

  async cancel(user: PatientJwtPayload, id: string) {
    const request = await this.findOwned(user.sub, id);
    if (request.status !== EmergencyRequestStatus.SUBMITTED) {
      throw new ConflictException(
        'Emergency request can only be cancelled while it is submitted.',
      );
    }

    return this.prisma.emergencyRequest.update({
      where: { id },
      data: {
        status: EmergencyRequestStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: PATIENT_INCLUDE,
    });
  }

  private async findOwned(patientId: string, id: string) {
    const request = await this.prisma.emergencyRequest.findFirst({
      where: { id, patientId },
      include: PATIENT_INCLUDE,
    });
    if (!request) {
      throw new NotFoundException(`Emergency request "${id}" not found.`);
    }
    return request;
  }
}
