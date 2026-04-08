import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import {
  CreateImagingRequestDto,
  UpdateImagingRequestDto,
} from './dto/create-imaging-request.dto';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';
import { parseDateRange } from '../../common/utils/date-range';

@Injectable()
export class ImagingRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(dto: CreateImagingRequestDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });
    if (!encounter)
      throw new NotFoundException(`Encounter "${dto.encounterId}" not found.`);
    if (encounter.patientId !== dto.patientId)
      throw new BadRequestException('Patient does not match the encounter.');
    const imagingRequest = await this.prisma.imagingRequest.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        requestedByDoctorId: dto.requestedByDoctorId,
        studyType: dto.studyType,
        modality: dto.modality,
        notes: dto.notes,
      },
      include: {
        encounter: { select: { id: true, encounterType: true, status: true } },
        patient: {
          select: { id: true, firstName: true, surname: true, patientId: true },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
      },
    });
    if (dto.serviceId) {
      await this.invoiceService.assertServiceCategoryForEncounterBilling(
        dto.serviceId,
        'radiology',
      );
      await this.invoiceService.createWithServiceItem({
        patientId: dto.patientId,
        drugId: dto.drugId,
        encounterId: dto.encounterId,
        staffId: dto.requestedByDoctorId,
        serviceId: dto.serviceId,
      });
    } else if (dto.drugId) {
      await this.invoiceService.createWithServiceItem({
        patientId: dto.patientId,
        drugId: dto.drugId,
        encounterId: dto.encounterId,
        staffId: dto.requestedByDoctorId,
        serviceId: dto.serviceId,
      });
    }
    return imagingRequest;
  }

  async findAll(
    query: DateRangeSkipTakeDto & { encounterId?: string; patientId?: string },
  ) {
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
      this.prisma.imagingRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          encounter: {
            select: { id: true, encounterType: true, status: true },
          },
          patient: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              patientId: true,
            },
          },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.imagingRequest.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const request = await this.prisma.imagingRequest.findUnique({
      where: { id },
      include: {
        encounter: true,
        patient: true,
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, staffId: true },
        },
      },
    });
    if (!request)
      throw new NotFoundException(`Imaging request "${id}" not found.`);
    return request;
  }

  async findByEncounterId(encounterId: string) {
    return this.prisma.imagingRequest.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateImagingRequestDto) {
    await this.findOne(id);
    return this.prisma.imagingRequest.update({
      where: { id },
      data: dto,
      include: {
        encounter: { select: { id: true, status: true } },
        patient: { select: { id: true, firstName: true, surname: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.imagingRequest.delete({ where: { id } });
    return { message: 'Imaging request removed successfully.' };
  }
}
