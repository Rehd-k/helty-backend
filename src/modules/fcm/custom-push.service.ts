import { Injectable, Logger } from '@nestjs/common';
import { PatientDeviceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SendCustomPushDto } from './dto/send-custom-push.dto';
import { FcmService } from './fcm.service';

@Injectable()
export class CustomPushService {
  private readonly logger = new Logger(CustomPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  async send(sentById: string, dto: SendCustomPushDto) {
    const selectedIds = (dto.patientIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean);
    const targetType = selectedIds.length > 0 ? 'SELECTED' : 'ALL';

    const tokenRows = await this.prisma.patientDevice.findMany({
      where: {
        status: PatientDeviceStatus.APPROVED,
        fcmToken: { not: null },
        ...(targetType === 'SELECTED'
          ? { patientId: { in: selectedIds } }
          : {}),
      },
      select: { fcmToken: true, patientId: true },
    });

    const targetedPatientIds = [
      ...new Set(tokenRows.map((r) => r.patientId)),
    ];
    const tokens = tokenRows
      .map((r) => r.fcmToken)
      .filter((t): t is string => !!t?.trim());

    let successCount = 0;
    let failureCount = 0;

    if (!this.fcm.isConfigured()) {
      this.logger.warn('FCM not configured; custom push recorded as failed');
      failureCount = tokens.length || 1;
    } else if (tokens.length === 0) {
      failureCount = 0;
    } else {
      const result = await this.fcm.sendToTokens(tokens, {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: { type: 'CUSTOM' },
      });
      successCount = result.successCount;
      failureCount = result.failureCount;
    }

    const record = await this.prisma.customPushNotification.create({
      data: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl ?? null,
        targetType,
        patientIds: targetType === 'SELECTED' ? selectedIds : [],
        sentById,
        successCount,
        failureCount,
      },
    });

    return {
      id: record.id,
      targetType,
      targetedPatients: targetedPatientIds.length,
      successCount,
      failureCount,
    };
  }
}
