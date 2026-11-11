import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../../common/utils/patient-display-name.util';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { CreateLabSampleDto } from './dto/create-lab-sample.dto';

@Injectable()
export class LabSampleService {
  private readonly logger = new Logger(LabSampleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  private hospitalName(): string {
    return (
      this.config.get<string>('HOSPITAL_NAME')?.trim() || 'Helty Hospital'
    );
  }

  async create(dto: CreateLabSampleDto) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: dto.orderItemId },
      include: {
        sample: true,
        testVersion: {
          include: { test: { select: { id: true, name: true } } },
        },
        order: {
          select: {
            id: true,
            patient: {
              select: {
                ...patientNameFieldsSelect,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    if (!orderItem) {
      throw new NotFoundException(
        `Lab order item "${dto.orderItemId}" not found.`,
      );
    }
    if (orderItem.sample) {
      throw new ConflictException(
        `Sample already recorded for order item "${dto.orderItemId}".`,
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.collectedBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.collectedBy}" not found.`);
    }

    const collectionTime = new Date(dto.collectionTime);
    const sample = await this.prisma.labSample.create({
      data: {
        orderItemId: dto.orderItemId,
        sampleType: dto.sampleType,
        collectedById: dto.collectedBy,
        collectionTime,
        barcode: dto.barcode,
      },
      include: {
        orderItem: {
          include: {
            testVersion: {
              include: { test: { select: { id: true, name: true } } },
            },
          },
        },
        collectedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const orderId = orderItem.orderId;
    await this.prisma.labOrder.updateMany({
      where: {
        id: orderId,
        sampleCollectedAt: null,
      },
      data: {
        sampleCollectedAt: collectionTime,
        status: 'SAMPLE_COLLECTED',
      },
    });

    void this.notifySampleCollected(orderItem).catch((err) => {
      this.logger.error(
        `WhatsApp sample collected failed orderItem=${dto.orderItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return sample;
  }

  private async notifySampleCollected(orderItem: {
    testVersion?: { test?: { name?: string | null } | null } | null;
    order?: {
      patient?: {
        phoneNumber?: string | null;
        title?: string | null;
        firstName?: string | null;
        otherName?: string | null;
        surname?: string | null;
      } | null;
    } | null;
  }): Promise<void> {
    const patient = orderItem.order?.patient;
    const phone = patient?.phoneNumber?.trim() ?? '';
    if (!phone) return;

    await this.whatsappService.sendSampleCollected(
      phone,
      formatPatientDisplayName(patient ?? {}),
      orderItem.testVersion?.test?.name?.trim() || 'Lab test',
      this.hospitalName(),
    );
  }
}
