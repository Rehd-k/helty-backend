import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentNotificationChannel,
  AppointmentNotificationKind,
  AppointmentNotificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { patientNameFieldsSelect } from '../../../common/utils/patient-display-name.util';
import { MailService } from '../../mail/mail.service';
import { SmsService } from '../../sms/sms.service';
import {
  AppointmentNotificationContext,
  PersistedNotificationAttempt,
} from './appointment-notification.types';
import { ChannelSendResult } from '../../../common/types/channel-send-result';
import {
  buildAppointmentMessages,
  buildIdempotencyKey,
  formatPatientName,
  getLagosDateBucket,
  getLagosDayBounds,
  isReminderEligibleStatus,
} from './appointment-message.util';

@Injectable()
export class AppointmentNotificationService {
  private readonly logger = new Logger(AppointmentNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly config: ConfigService,
  ) {}

  private hospitalName(): string {
    return (
      this.config.get<string>('HOSPITAL_NAME')?.trim() || 'Helty Hospital'
    );
  }

  async notifyCreated(appointmentId: string): Promise<void> {
    await this.dispatchForAppointment(appointmentId, 'CREATED', {
      eventMarker: 'created',
    });
  }

  async notifyRescheduled(
    appointmentId: string,
    previousDate: Date,
  ): Promise<void> {
    await this.dispatchForAppointment(appointmentId, 'RESCHEDULED', {
      eventMarker: `rescheduled:${previousDate.toISOString()}`,
      previousDate,
    });
  }

  async notifyCancelled(appointmentId: string): Promise<void> {
    await this.dispatchForAppointment(appointmentId, 'CANCELLED', {
      eventMarker: 'cancelled',
    });
  }

  async sendDayOfReminders(referenceDate: Date = new Date()): Promise<number> {
    const { from, to } = getLagosDayBounds(referenceDate);
    const dateBucket = getLagosDateBucket(referenceDate);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: { gte: from, lte: to },
      },
      include: {
        patient: {
          select: {
            ...patientNameFieldsSelect,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    const eligible = appointments.filter((a) =>
      isReminderEligibleStatus(a.status),
    );

    let sentCount = 0;
    for (const appointment of eligible) {
      const attempts = await this.dispatchForContext(
        {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          patientName: formatPatientName(appointment.patient),
          appointmentDate: appointment.date,
          email: appointment.patient.email,
          phoneNumber: appointment.patient.phoneNumber,
        },
        'REMINDER_DAY_OF',
        { dateBucket },
      );
      sentCount += attempts.filter((a) => a.status === 'SENT').length;
    }

    this.logger.log(
      `Day-of reminders processed dateBucket=${dateBucket} eligible=${eligible.length} sent=${sentCount}`,
    );
    return sentCount;
  }

  private async dispatchForAppointment(
    appointmentId: string,
    kind: AppointmentNotificationKind,
    options: { eventMarker?: string; previousDate?: Date; dateBucket?: string },
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          select: {
            ...patientNameFieldsSelect,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!appointment) {
      this.logger.warn(`Appointment ${appointmentId} not found for ${kind}`);
      return;
    }

    await this.dispatchForContext(
      {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientName: formatPatientName(appointment.patient),
        appointmentDate: appointment.date,
        previousDate: options.previousDate,
        email: appointment.patient.email,
        phoneNumber: appointment.patient.phoneNumber,
      },
      kind,
      options,
    );
  }

  private async dispatchForContext(
    ctx: AppointmentNotificationContext,
    kind: AppointmentNotificationKind,
    options: { eventMarker?: string; previousDate?: Date; dateBucket?: string },
  ): Promise<PersistedNotificationAttempt[]> {
    const messages = buildAppointmentMessages({
      kind,
      patientName: ctx.patientName,
      appointmentDate: ctx.appointmentDate,
      previousDate: options.previousDate ?? ctx.previousDate,
      hospitalName: this.hospitalName(),
    });

    const channels: Array<{
      channel: AppointmentNotificationChannel;
      send: () => Promise<ChannelSendResult>;
    }> = [
      {
        channel: 'EMAIL',
        send: () =>
          this.mailService.sendAppointmentNotification({
            to: ctx.email ?? '',
            subject: messages.subject,
            text: messages.text,
          }),
      },
      {
        channel: 'SMS',
        send: () =>
          this.smsService.sendAppointmentSms(
            ctx.phoneNumber ?? '',
            messages.sms,
          ),
      },
    ];

    const results: PersistedNotificationAttempt[] = [];

    for (const { channel, send } of channels) {
      try {
        const attempt = await this.sendAndPersist({
          ctx,
          kind,
          channel,
          idempotencyKey: buildIdempotencyKey({
            appointmentId: ctx.appointmentId,
            kind,
            channel,
            dateBucket: options.dateBucket,
            eventMarker: options.eventMarker,
          }),
          payloadSnapshot: {
            subject: messages.subject,
            text: messages.text,
            sms: messages.sms,
          },
          send,
        });
        results.push(attempt);
      } catch (err) {
        this.logger.error(
          `Notification dispatch failed appointment=${ctx.appointmentId} kind=${kind} channel=${channel}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return results;
  }

  private async sendAndPersist(params: {
    ctx: AppointmentNotificationContext;
    kind: AppointmentNotificationKind;
    channel: AppointmentNotificationChannel;
    idempotencyKey: string;
    payloadSnapshot: Prisma.InputJsonValue;
    send: () => Promise<ChannelSendResult>;
  }): Promise<PersistedNotificationAttempt> {
    const existing = await this.prisma.appointmentNotification.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      this.logger.debug(
        `Skipping duplicate notification key=${params.idempotencyKey}`,
      );
      return {
        id: existing.id,
        channel: existing.channel,
        kind: existing.kind,
        status: existing.status,
      };
    }

    const sendResult = await params.send();
    const status = this.mapSendResultToStatus(sendResult);
    const now = new Date();

    const record = await this.prisma.appointmentNotification.create({
      data: {
        appointmentId: params.ctx.appointmentId,
        patientId: params.ctx.patientId,
        channel: params.channel,
        kind: params.kind,
        idempotencyKey: params.idempotencyKey,
        scheduledFor:
          params.kind === 'REMINDER_DAY_OF' ? params.ctx.appointmentDate : null,
        sentAt: status === 'SENT' ? now : null,
        status,
        provider:
          sendResult.status === 'SENT' ? (sendResult.provider ?? null) : null,
        providerMessageId:
          sendResult.status === 'SENT'
            ? (sendResult.providerMessageId ?? null)
            : null,
        errorMessage:
          sendResult.status === 'FAILED' ? sendResult.errorMessage : null,
        payloadSnapshot: params.payloadSnapshot,
      },
    });

    this.logger.log(
      `Notification recorded appointment=${params.ctx.appointmentId} kind=${params.kind} channel=${params.channel} status=${status}`,
    );

    return {
      id: record.id,
      channel: record.channel,
      kind: record.kind,
      status: record.status,
    };
  }

  private mapSendResultToStatus(
    result: ChannelSendResult,
  ): AppointmentNotificationStatus {
    switch (result.status) {
      case 'SENT':
        return 'SENT';
      case 'SKIPPED_CONFIG':
        return 'SKIPPED_CONFIG';
      case 'SKIPPED_NO_CONTACT':
        return 'SKIPPED_NO_CONTACT';
      case 'FAILED':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }
}
