import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateLabRequestDto,
  UpdateLabRequestDto,
  ListLabRequestsQueryDto,
} from './dto/create-lab-request.dto';
import { parseDateRange } from '../../common/utils/date-range';
import { labRequestWithBillingInclude } from './lab-request-includes';

@Injectable()
export class LabRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateLabRequestDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    }
    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestException('Patient does not match the encounter.');
    }
    const labRequest = await this.prisma.labRequest.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        requestedByDoctorId: dto.requestedByDoctorId,
        testType: dto.testType,
        notes: dto.notes,
      },
    });
    if (dto.serviceId) {
      await this.invoiceService.assertServiceCategoryForEncounterBilling(
        dto.serviceId,
        'lab',
      );
      const { invoice, invoiceItemId } =
        await this.invoiceService.createWithServiceItem({
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          staffId: dto.requestedByDoctorId,
          serviceId: dto.serviceId,
        });
      return this.prisma.labRequest.update({
        where: { id: labRequest.id },
        data: { invoiceId: invoice.id, invoiceItemId },
        include: labRequestWithBillingInclude,
      });
    }
    return this.prisma.labRequest.findUniqueOrThrow({
      where: { id: labRequest.id },
      include: labRequestWithBillingInclude,
    });
  }

  async findAll(query: ListLabRequestsQueryDto) {
    const {
      skip = 0,
      take = 20,
      encounterId,
      patientId,
      fromDate,
      toDate,
    } = query;
    const { from, to } = parseDateRange(fromDate, toDate);

    const where: {
      encounterId?: string;
      patientId?: string;
      createdAt?: { gte: Date; lte: Date };
    } = {};
    if (encounterId) where.encounterId = encounterId;
    if (patientId) where.patientId = patientId;
    if (fromDate && toDate) where.createdAt = { gte: from, lte: to };

    const [data, total] = await Promise.all([
      this.prisma.labRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: labRequestWithBillingInclude,
      }),
      this.prisma.labRequest.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.labRequest.findUnique({
      where: { id },
      include: labRequestWithBillingInclude,
    });
    if (!request) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }
    return request;
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.labRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: labRequestWithBillingInclude,
    });
  }

  async update(id: string, dto: UpdateLabRequestDto) {
    await this.findOne(id);
    return this.prisma.labRequest.update({
      where: { id },
      data: dto,
      include: labRequestWithBillingInclude,
    });
  }

  async remove(id: string) {
    const found = await this.prisma.labRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Lab request "${id}" not found.`);
    }
    await this.prisma.labRequest.delete({ where: { id } });
    return { message: 'Lab request removed successfully.' };
  }
}
