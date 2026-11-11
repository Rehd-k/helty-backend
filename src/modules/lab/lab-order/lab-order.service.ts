import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceStatus, LabOrderStatus, LabRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseDateRange } from '../../../common/utils/date-range';
import { InvoiceService } from '../../invoice/invoice.service';
import { invoiceLinkException } from '../../../common/exceptions/invoice-link.exception';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { patientNameFieldsSelect } from '../../../common/utils/patient-display-name.util';
import { getPatientAdmissionContext } from '../../../common/utils/patient-admission-context.util';
import { ChannelSendResult } from '../../../common/types/channel-send-result';
import { MailService } from '../../mail/mail.service';
import { SmsService } from '../../sms/sms.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { SendLabResultsToPatientDto } from './dto/send-lab-results-to-patient.dto';
import { LabReportStorageService } from './lab-report-storage.service';
import { LabSendJobService } from './lab-send-job.service';
import {
  LAB_SEND_STAGE_LABELS,
  LabSendJobStatus,
} from './lab-send-progress.types';

const wardSelect = { select: { id: true, name: true } } as const;

const labOrderPatientSelect = {
  ...patientNameFieldsSelect,
  email: true,
  phoneNumber: true,
} as const;

@Injectable()
export class LabOrderService {
  private readonly logger = new Logger(LabOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly whatsappService: WhatsappService,
    private readonly config: ConfigService,
    private readonly labReportStorage: LabReportStorageService,
    private readonly labSendJobs: LabSendJobService,
  ) { }

  private hospitalName(): string {
    return (
      this.config.get<string>('HOSPITAL_NAME')?.trim() || 'Helty Hospital'
    );
  }

  private formatLabDate(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  private formatLabTime(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  async create(dto: CreateLabOrderDto) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    const doctor = await this.prisma.staff.findUnique({
      where: { id: dto.doctorId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor "${dto.doctorId}" not found.`);
    }

    const versionIds = dto.items.map((i) => i.testVersionId);
    const activeVersions = await this.prisma.labTestVersion.findMany({
      where: { id: { in: versionIds }, isActive: true },
    });
    if (activeVersions.length !== versionIds.length) {
      const foundIds = new Set(activeVersions.map((v) => v.id));
      const invalid = versionIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Only active test versions can be ordered. Invalid or inactive version(s): ${invalid.join(', ')}`,
      );
    }

    const orderInclude = {
      patient: {
        select: labOrderPatientSelect,
      },
      doctor: {
        select: { id: true, firstName: true, lastName: true, staffId: true },
      },
      ward: wardSelect,
      invoiceItem: {
        select: { id: true, invoiceId: true, serviceId: true },
      },
      items: {
        include: {
          testVersion: {
            include: {
              test: { select: { id: true, name: true, sampleType: true } },
            },
          },
        },
      },
    } as const;

    const hasInvoiceLink = !!(
      dto.invoiceId ||
      dto.invoiceItemId ||
      dto.serviceId
    );
    if (hasInvoiceLink) {
      if (!dto.invoiceId || !dto.invoiceItemId || !dto.serviceId) {
        throw invoiceLinkException(
          'INVALID_INVOICE_LINK_PAYLOAD',
          'invoiceId, invoiceItemId, and serviceId must all be provided together.',
        );
      }
      return this.prisma.$transaction(async (tx) => {
        await this.invoiceService.assertPaidInvoiceItemConsumable(
          tx,
          {
            invoiceId: dto.invoiceId!,
            invoiceItemId: dto.invoiceItemId!,
            serviceId: dto.serviceId!,
            patientId: dto.patientId,
            mode: 'lab',
          },
          { requirePayment: false },
        );
        const linkedRequest = await tx.labRequest.findFirst({
          where: {
            invoiceItemId: dto.invoiceItemId!,
            status: { not: LabRequestStatus.CANCELLED },
          },
          select: { admissionId: true, wardId: true },
          orderBy: { createdAt: 'desc' },
        });
        const admissionCtx =
          linkedRequest?.admissionId || linkedRequest?.wardId
            ? {
                admissionId: linkedRequest.admissionId,
                wardId: linkedRequest.wardId,
              }
            : await getPatientAdmissionContext(tx, dto.patientId);
        const order = await tx.labOrder.create({
          data: {
            patientId: dto.patientId,
            doctorId: dto.doctorId,
            status: 'PENDING',
            invoiceItemId: dto.invoiceItemId!,
            admissionId: admissionCtx.admissionId,
            wardId: admissionCtx.wardId,
            items: {
              create: dto.items.map((item) => ({
                testVersionId: item.testVersionId,
                status: 'PENDING',
                astRequested: item.astRequested ?? false,
              })),
            },
          },
          include: orderInclude,
        });
        await tx.labRequest.updateMany({
          where: {
            invoiceItemId: dto.invoiceItemId!,
            status: { not: LabRequestStatus.CANCELLED },
          },
          data: { status: LabRequestStatus.COLLECTED },
        });
        return order;
      });
    }

    const admissionCtx = await getPatientAdmissionContext(
      this.prisma,
      dto.patientId,
    );
    return this.prisma.labOrder.create({
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        status: 'PENDING',
        admissionId: admissionCtx.admissionId,
        wardId: admissionCtx.wardId,
        items: {
          create: dto.items.map((item) => ({
            testVersionId: item.testVersionId,
            status: 'PENDING',
            astRequested: item.astRequested ?? false,
          })),
        },
      },
      include: orderInclude,
    });
  }

  async findAll(query: ListOrdersQueryDto) {
    const where: Prisma.LabOrderWhereInput = {
      NOT: { invoiceItem: { invoice: { status: InvoiceStatus.DELETED } } },
    };
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;
    if (query.fromDate || query.toDate) {
      const { from, to } = parseDateRange(query.fromDate, query.toDate);
      where.createdAt = { gte: from, lte: to };
    }

    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.labOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: labOrderPatientSelect,
          },
          doctor: { select: { id: true, firstName: true, lastName: true } },
          ward: wardSelect,
          invoiceItem: {
            select: { id: true, invoiceId: true, serviceId: true },
          },
          items: {
            include: {
              testVersion: {
                include: { test: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.labOrder.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        patient: {
          select: labOrderPatientSelect,
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, staffId: true, accountType: true },
        },
        ward: wardSelect,
        invoiceItem: {
          select: { id: true, invoiceId: true, serviceId: true },
        },
        items: {
          include: {
            testVersion: {
              include: {
                test: { select: { id: true, name: true, sampleType: true } },
                fields: { orderBy: { position: 'asc' } },
              },
            },
            sample: true,
            results: { include: { field: true } },
            astResults: {
              include: {
                antibiotic: true,
                resultOption: true,
                enteredBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
              orderBy: [
                { antibiotic: { position: 'asc' } },
                { antibiotic: { name: 'asc' } },
              ],
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Lab order "${id}" not found.`);
    }
    return order;
  }

  async update(id: string, dto: UpdateLabOrderDto) {
    await this.findOne(id);
    const now = new Date();
    const data: Prisma.LabOrderUpdateInput = {};
    if (dto.status === LabOrderStatus.COMPLETED) {
      data.status = dto.status;
      data.completedAt = now;
    }
    if (dto.status === LabOrderStatus.VERIFIED) {
      data.status = dto.status;
      data.verifiedAt = now;
      data.completedAt = now;
    }
    if (
      dto.status !== undefined &&
      dto.status !== LabOrderStatus.COMPLETED &&
      dto.status !== LabOrderStatus.VERIFIED
    ) {
      data.status = dto.status;
    }
    if (dto.reportDoctorName !== undefined) {
      const trimmed = dto.reportDoctorName.trim();
      data.reportDoctorName = trimmed.length === 0 ? null : trimmed;
    }
    const updated = await this.prisma.labOrder.update({
      where: { id },
      data,
      include: {
        patient: { select: labOrderPatientSelect },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        ward: wardSelect,
        invoiceItem: {
          select: { id: true, invoiceId: true, serviceId: true },
        },
        items: {
          include: {
            testVersion: {
              include: { test: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (
      dto.status === LabOrderStatus.VERIFIED ||
      dto.status === LabOrderStatus.COMPLETED
    ) {
      await this.syncLabRequestCompletedForInvoiceItem(updated.invoiceItemId);
    }
    return updated;
  }

  /**
   * Starts an async send job (email and/or WhatsApp phone delivery).
   * Poll GET /lab/orders/send-jobs/:jobId for granular progress.
   */
  async sendToPatient(
    dto: SendLabResultsToPatientDto,
  ): Promise<{ jobId: string }> {
    if (!dto.sendEmail && !dto.sendSms) {
      throw new BadRequestException('Select email, phone, or both.');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: {
        email: true,
        phoneNumber: true,
        firstName: true,
        surname: true,
      },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }

    const email = patient.email?.trim() ?? '';
    const phone = patient.phoneNumber?.trim() ?? '';
    if (dto.sendEmail && !email) {
      throw new BadRequestException('This patient has no email on file.');
    }
    if (dto.sendSms && !phone) {
      throw new BadRequestException('This patient has no phone number on file.');
    }
    if (!dto.pdfBase64?.trim()) {
      throw new BadRequestException(
        'Laboratory report PDF is required to send results.',
      );
    }

    const job = this.labSendJobs.createQueued();
    const name =
      [patient.firstName, patient.surname].filter((part) => part?.trim()).join(' ') ||
      'Patient';

    void this.runSendToPatientJob(job.jobId, {
      dto,
      patientName: name,
      email,
      phone,
    }).catch((err) => {
      const message =
        err instanceof Error ? err.message : 'Unknown lab send failure';
      this.logger.error(`Lab send job crashed jobId=${job.jobId}: ${message}`);
      try {
        this.labSendJobs.fail(job.jobId, message);
      } catch {
        /* job may already be gone */
      }
    });

    return { jobId: job.jobId };
  }

  getSendJob(jobId: string): LabSendJobStatus {
    return this.labSendJobs.get(jobId);
  }

  private async runSendToPatientJob(
    jobId: string,
    ctx: {
      dto: SendLabResultsToPatientDto;
      patientName: string;
      email: string;
      phone: string;
    },
  ): Promise<void> {
    const { dto, patientName, email, phone } = ctx;
    const sendWhatsApp = dto.sendSms;
    const totalSteps = sendWhatsApp ? 3 : null;

    this.labSendJobs.update(jobId, {
      stage: 'GENERATING_PDF',
      message: LAB_SEND_STAGE_LABELS.GENERATING_PDF,
      step: sendWhatsApp ? 1 : null,
      totalSteps,
    });

    const pdfBuffer = this.decodePdfBase64(dto.pdfBase64!);
    if (!pdfBuffer) {
      this.labSendJobs.fail(
        jobId,
        'Failed to compile laboratory report PDF (invalid or empty payload).',
      );
      return;
    }

    let pdfUrl: string | undefined;
    let emailStatus: 'SENT' | 'SKIPPED' | 'FAILED' = dto.sendEmail
      ? 'FAILED'
      : 'SKIPPED';
    let smsStatus: 'SENT' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
    let whatsappStatus: 'SENT' | 'SKIPPED' | 'FAILED' = sendWhatsApp
      ? 'FAILED'
      : 'SKIPPED';

    if (sendWhatsApp) {
      this.labSendJobs.update(jobId, {
        stage: 'UPLOADING_FILE',
        message: LAB_SEND_STAGE_LABELS.UPLOADING_FILE,
        step: 2,
        totalSteps,
      });
      try {
        const stored = await this.labReportStorage.savePdf(pdfBuffer);
        pdfUrl = stored.pdfUrl;
      } catch (err) {
        this.labSendJobs.fail(
          jobId,
          err instanceof Error
            ? err.message
            : 'Failed to store laboratory report PDF.',
        );
        return;
      }
    }

    if (dto.sendEmail) {
      this.labSendJobs.update(jobId, {
        stage: 'SENDING_EMAIL',
        message: LAB_SEND_STAGE_LABELS.SENDING_EMAIL,
        step: sendWhatsApp ? 2 : null,
        totalSteps,
      });
      const result = await this.mailService.sendLabResultsPdf({
        to: email,
        subject: `Laboratory results – ${patientName}`,
        text: 'Your laboratory report is attached.',
        pdfBase64: dto.pdfBase64!,
        filename: 'laboratory-results.pdf',
      });
      const error = this.channelError('Email', result);
      if (error) {
        this.labSendJobs.fail(jobId, error);
        return;
      }
      emailStatus = 'SENT';
    }

    if (sendWhatsApp) {
      this.labSendJobs.update(jobId, {
        stage: 'SENDING_WHATSAPP',
        message: LAB_SEND_STAGE_LABELS.SENDING_WHATSAPP,
        step: 3,
        totalSteps,
      });

      const now = new Date();
      const whatsappResult = await this.whatsappService.sendLabResults({
        phone,
        patientName,
        orgName: this.hospitalName(),
        date: this.formatLabDate(now),
        time: this.formatLabTime(now),
        pdfUrl: pdfUrl!,
      });
      const whatsappError = this.channelError('WhatsApp', whatsappResult);
      if (whatsappError) {
        this.labSendJobs.fail(jobId, whatsappError);
        return;
      }
      whatsappStatus = 'SENT';

      if (dto.smsText?.trim()) {
        const smsResult = await this.smsService.sendSms(
          phone,
          dto.smsText.trim(),
        );
        if (smsResult.status === 'SENT') {
          smsStatus = 'SENT';
        } else if (
          smsResult.status === 'SKIPPED_CONFIG' ||
          smsResult.status === 'SKIPPED_NO_CONTACT'
        ) {
          smsStatus = 'SKIPPED';
        } else {
          smsStatus = 'FAILED';
          const smsError = this.channelError('SMS', smsResult);
          if (smsError) {
            this.logger.warn(
              `WhatsApp sent but SMS failed jobId=${jobId}: ${smsError}`,
            );
          }
        }
      }
    }

    this.labSendJobs.update(jobId, {
      stage: 'SENT',
      message: sendWhatsApp
        ? LAB_SEND_STAGE_LABELS.SENT
        : 'Results delivered successfully',
      step: sendWhatsApp ? 3 : null,
      totalSteps,
      result: {
        email: emailStatus,
        sms: smsStatus,
        whatsapp: whatsappStatus,
        ...(pdfUrl ? { pdfUrl } : {}),
      },
    });
  }

  private decodePdfBase64(pdfBase64: string): Buffer | null {
    const trimmed = pdfBase64.trim();
    if (!trimmed) return null;
    const raw = trimmed.includes(',')
      ? trimmed.slice(trimmed.indexOf(',') + 1)
      : trimmed;
    try {
      const buffer = Buffer.from(raw, 'base64');
      if (!buffer.length) return null;
      if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) return null;
      return buffer;
    } catch {
      return null;
    }
  }

  async updateItemNotes(itemId: string, scientistNotes?: string | null) {
    const item = await this.prisma.labOrderItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(`Lab order item "${itemId}" not found.`);
    }
    const trimmed = scientistNotes?.trim() ?? '';
    return this.prisma.labOrderItem.update({
      where: { id: itemId },
      data: { scientistNotes: trimmed.length === 0 ? null : trimmed },
      select: { id: true, scientistNotes: true },
    });
  }

  private channelError(channel: string, result: ChannelSendResult): string | null {
    switch (result.status) {
      case 'SENT':
        return null;
      case 'SKIPPED_CONFIG':
        return `${channel} could not be sent because it is not configured.`;
      case 'SKIPPED_NO_CONTACT':
        return `${channel} could not be sent because the contact is missing or invalid.`;
      case 'FAILED':
        return `${channel} failed: ${result.errorMessage}`;
    }
  }

  private async syncLabRequestCompletedForInvoiceItem(
    invoiceItemId: string | null,
  ) {
    if (!invoiceItemId) return;
    await this.prisma.labRequest.updateMany({
      where: {
        invoiceItemId,
        status: { not: LabRequestStatus.CANCELLED },
      },
      data: { status: LabRequestStatus.COMPLETED },
    });
  }
}
