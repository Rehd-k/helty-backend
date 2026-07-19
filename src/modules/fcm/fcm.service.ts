import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PatientDeviceStatus } from '@prisma/client';
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';
import { ChannelSendResult } from '../../common/types/channel-send-result';
import { PrismaService } from '../../prisma/prisma.service';

export interface FcmPushPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

export interface FcmMulticastResult {
  successCount: number;
  failureCount: number;
  staleTokensRemoved: number;
}

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private ready = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    if (getApps().length > 0) {
      this.ready = true;
      return;
    }

    const configured =
      this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH')?.trim() ||
      './firebase-service-account.json';
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);

    if (!fs.existsSync(resolved)) {
      this.logger.warn(
        `Firebase service account not found at ${resolved}; FCM pushes will be skipped.`,
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        fs.readFileSync(resolved, 'utf8'),
      ) as ServiceAccount;
      initializeApp({
        credential: cert(serviceAccount),
      });
      this.ready = true;
      this.logger.log('Firebase Admin initialized for FCM');
    } catch (err) {
      this.logger.error(
        `Failed to initialize Firebase Admin: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  isConfigured(): boolean {
    return this.ready;
  }

  /**
   * Sends a push to all APPROVED devices with an FCM token for a patient.
   */
  async sendToPatient(
    patientId: string,
    payload: FcmPushPayload,
  ): Promise<ChannelSendResult> {
    if (!this.ready) {
      return { status: 'SKIPPED_CONFIG' };
    }

    const rows = await this.prisma.patientDevice.findMany({
      where: {
        patientId,
        status: PatientDeviceStatus.APPROVED,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });
    const tokens = rows
      .map((r) => r.fcmToken)
      .filter((t): t is string => !!t?.trim());
    if (tokens.length === 0) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const result = await this.sendToTokens(tokens, payload);
    if (result.successCount > 0) {
      return { status: 'SENT', provider: 'fcm' };
    }
    if (result.failureCount === 0) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }
    return {
      status: 'FAILED',
      errorMessage: `FCM failed for all ${result.failureCount} token(s)`,
    };
  }

  /**
   * Send to a single device by id (e.g. DEVICE_APPROVED), even if still
   * transitioning — caller decides. Token must be present.
   */
  async sendToDevice(
    deviceId: string,
    payload: FcmPushPayload,
  ): Promise<ChannelSendResult> {
    if (!this.ready) {
      return { status: 'SKIPPED_CONFIG' };
    }

    const device = await this.prisma.patientDevice.findUnique({
      where: { id: deviceId },
      select: { fcmToken: true },
    });
    if (!device?.fcmToken?.trim()) {
      return { status: 'SKIPPED_NO_CONTACT' };
    }

    const result = await this.sendToTokens([device.fcmToken], payload);
    if (result.successCount > 0) {
      return { status: 'SENT', provider: 'fcm' };
    }
    return {
      status: 'FAILED',
      errorMessage: 'FCM failed for device token',
    };
  }

  async sendToTokens(
    tokens: string[],
    payload: FcmPushPayload,
  ): Promise<FcmMulticastResult> {
    if (!this.ready) {
      return { successCount: 0, failureCount: 0, staleTokensRemoved: 0 };
    }

    const unique = [...new Set(tokens.filter((t) => t?.trim()))];
    if (unique.length === 0) {
      return { successCount: 0, failureCount: 0, staleTokensRemoved: 0 };
    }

    const message: MulticastMessage = {
      tokens: unique,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data,
      android: payload.imageUrl
        ? { notification: { imageUrl: payload.imageUrl } }
        : undefined,
      apns: payload.imageUrl
        ? {
            fcmOptions: { imageUrl: payload.imageUrl },
          }
        : undefined,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      const stale: string[] = [];

      response.responses.forEach((res, index) => {
        if (res.success) return;
        const code = res.error?.code;
        if (code && STALE_TOKEN_CODES.has(code)) {
          stale.push(unique[index]);
        } else if (res.error) {
          this.logger.warn(
            `FCM send failed tokenIndex=${index} code=${code}: ${res.error.message}`,
          );
        }
      });

      let staleTokensRemoved = 0;
      if (stale.length > 0) {
        const cleared = await this.prisma.patientDevice.updateMany({
          where: { fcmToken: { in: stale } },
          data: { fcmToken: null },
        });
        staleTokensRemoved = cleared.count;
        this.logger.log(`Cleared ${staleTokensRemoved} stale FCM token(s)`);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        staleTokensRemoved,
      };
    } catch (err) {
      this.logger.error(
        `FCM multicast failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        successCount: 0,
        failureCount: unique.length,
        staleTokensRemoved: 0,
      };
    }
  }
}
