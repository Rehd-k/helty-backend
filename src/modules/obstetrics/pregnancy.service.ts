import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PregnancyStatus } from '@prisma/client';
import {
  CreatePregnancyDto,
  UpdatePregnancyDto,
} from './dto/create-pregnancy.dto';
import { ListPregnanciesQueryDto } from './dto/list-pregnancies-query.dto';

@Injectable()
export class PregnancyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePregnancyDto, createdById: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { patientId: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${dto.patientId}" not found.`);
    }
    return this.prisma.pregnancy.create({
      data: {
        patientId: patient.id,
        gravida: dto.gravida,
        para: dto.para,
        lmp: new Date(dto.lmp),
        edd: new Date(dto.edd),
        bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : null,
        status: dto.status ?? 'ONGOING',
        outcome: dto.outcome ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
        heartRate: dto.heartRate ?? null,
        systolicBP: dto.systolicBP ?? null,
        diastolicBP: dto.diastolicBP ?? null,
        spo2: dto.spo2 ?? null,
        genotype: dto.genotype ?? null,
        bloodGroup: dto.bloodGroup ?? null,
        pcv: dto.pcv ?? null,
        hcv: dto.hcv ?? null,
        hbsAg: dto.hbsAg ?? null,
        vdrl: dto.vdrl ?? null,
        hiv12: dto.hiv12 ?? null,
        urinalysisProtein: dto.urinalysisProtein ?? null,
        urinalysisGlucose: dto.urinalysisGlucose ?? null,
        ttImmunization: dto.ttImmunization ?? null,
        createdById,
        updatedById: createdById,
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
      },
    });
  }

  async findAll(query: ListPregnanciesQueryDto) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const where: { patientId?: string; status?: PregnancyStatus } = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.status) where.status = query.status;

    const [pregnancies, total] = await Promise.all([
      this.prisma.pregnancy.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, surname: true } },
        },
      }),
      this.prisma.pregnancy.count({ where }),
    ]);

    return { pregnancies, total, skip, take };
  }

  async findOne(id: string) {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id },
      include: {
        patient: true,

        antenatalVisits: { orderBy: { visitDate: 'desc' }, take: 10 },
        labourDeliveries: true,
      },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${id}" not found.`);
    }
    return pregnancy;
  }

  async update(id: string, dto: UpdatePregnancyDto, staffId: string) {
    await this.findOne(id);
    return this.prisma.pregnancy.update({
      where: { id },
      data: {
        ...(dto.gravida !== undefined && { gravida: dto.gravida }),
        ...(dto.para !== undefined && { para: dto.para }),
        ...(dto.lmp !== undefined && { lmp: new Date(dto.lmp) }),
        ...(dto.edd !== undefined && { edd: new Date(dto.edd) }),
        ...(dto.bookingDate !== undefined && {
          bookingDate: dto.bookingDate ? new Date(dto.bookingDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.respiratoryRate !== undefined && {
          respiratoryRate: dto.respiratoryRate,
        }),
        ...(dto.heartRate !== undefined && { heartRate: dto.heartRate }),
        ...(dto.systolicBP !== undefined && { systolicBP: dto.systolicBP }),
        ...(dto.diastolicBP !== undefined && { diastolicBP: dto.diastolicBP }),
        ...(dto.spo2 !== undefined && { spo2: dto.spo2 }),
        ...(dto.genotype !== undefined && { genotype: dto.genotype }),
        ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
        ...(dto.pcv !== undefined && { pcv: dto.pcv }),
        ...(dto.hcv !== undefined && { hcv: dto.hcv }),
        ...(dto.hbsAg !== undefined && { hbsAg: dto.hbsAg }),
        ...(dto.vdrl !== undefined && { vdrl: dto.vdrl }),
        ...(dto.hiv12 !== undefined && { hiv12: dto.hiv12 }),
        ...(dto.urinalysisProtein !== undefined && {
          urinalysisProtein: dto.urinalysisProtein,
        }),
        ...(dto.urinalysisGlucose !== undefined && {
          urinalysisGlucose: dto.urinalysisGlucose,
        }),
        ...(dto.ttImmunization !== undefined && {
          ttImmunization: dto.ttImmunization,
        }),
        updatedById: staffId,
      },
      include: {
        patient: { select: { id: true, firstName: true, surname: true } },
      },
    });
  }
}
