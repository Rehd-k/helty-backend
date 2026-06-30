import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRange } from '../../common/utils/date-range';
import { QualitySafetyListQueryDto } from './dto/quality-safety-list.query.dto';
import { CreateReferralDto, UpdateReferralDto } from './dto/referral.dto';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaint.dto';
import { CreateIncidentDto, UpdateIncidentDto } from './dto/incident.dto';
import { CreateInfectionDto, UpdateInfectionDto } from './dto/infection.dto';
import { patientNameFieldsSelect } from '../../common/utils/patient-display-name.util';

@Injectable()
export class QualitySafetyService {
  constructor(private readonly prisma: PrismaService) {}

  private listWindow(q: QualitySafetyListQueryDto): {
    from?: Date;
    to?: Date;
  } {
    if (!q.from && !q.to) return {};
    const { from, to } = parseDateRange(q.from, q.to);
    return { from, to };
  }

  private occurredFilter(
    q: QualitySafetyListQueryDto,
    field: string,
  ): Prisma.ReferralWhereInput {
    const { from, to } = this.listWindow(q);
    if (!from && !to) return {};
    return {
      [field]: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    } as Prisma.ReferralWhereInput;
  }

  // ─── Referrals ─────────────────────────────────────────────────────────────

  async createReferral(dto: CreateReferralDto, staffId: string) {
    return this.prisma.referral.create({
      data: {
        patientId: dto.patientId,
        direction: dto.direction,
        referringFacility: dto.referringFacility,
        receivingFacility: dto.receivingFacility,
        reason: dto.reason,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        departmentId: dto.departmentId,
        createdById: staffId,
      },
      include: this.referralInclude(),
    });
  }

  async listReferrals(q: QualitySafetyListQueryDto) {
    const where: Prisma.ReferralWhereInput = {
      ...this.occurredFilter(q, 'occurredAt'),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.status ? { status: q.status as Prisma.EnumReferralStatusFilter['equals'] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        skip: q.skip ?? 0,
        take: q.take ?? 50,
        orderBy: { occurredAt: 'desc' },
        include: this.referralInclude(),
      }),
      this.prisma.referral.count({ where }),
    ]);
    return { items, total };
  }

  async getReferral(id: string) {
    const row = await this.prisma.referral.findUnique({
      where: { id },
      include: this.referralInclude(),
    });
    if (!row) throw new NotFoundException(`Referral "${id}" not found.`);
    return row;
  }

  async updateReferral(id: string, dto: UpdateReferralDto) {
    await this.getReferral(id);
    return this.prisma.referral.update({
      where: { id },
      data: {
        direction: dto.direction,
        status: dto.status,
        referringFacility: dto.referringFacility,
        receivingFacility: dto.receivingFacility,
        reason: dto.reason,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        departmentId: dto.departmentId,
      },
      include: this.referralInclude(),
    });
  }

  private referralInclude() {
    return {
      patient: { select: patientNameFieldsSelect },
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  // ─── Complaints ────────────────────────────────────────────────────────────

  async createComplaint(dto: CreateComplaintDto, staffId: string) {
    return this.prisma.patientComplaint.create({
      data: {
        patientId: dto.patientId,
        category: dto.category,
        description: dto.description,
        severity: dto.severity,
        reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : undefined,
        encounterId: dto.encounterId,
        departmentId: dto.departmentId,
        assignedToId: dto.assignedToId,
        createdById: staffId,
      },
      include: this.complaintInclude(),
    });
  }

  async listComplaints(q: QualitySafetyListQueryDto) {
    const { from, to } = this.listWindow(q);
    const where: Prisma.PatientComplaintWhereInput = {
      ...(from || to
        ? {
            reportedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.status
        ? { status: q.status as Prisma.EnumComplaintStatusFilter['equals'] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.patientComplaint.findMany({
        where,
        skip: q.skip ?? 0,
        take: q.take ?? 50,
        orderBy: { reportedAt: 'desc' },
        include: this.complaintInclude(),
      }),
      this.prisma.patientComplaint.count({ where }),
    ]);
    return { items, total };
  }

  async getComplaint(id: string) {
    const row = await this.prisma.patientComplaint.findUnique({
      where: { id },
      include: this.complaintInclude(),
    });
    if (!row) throw new NotFoundException(`Complaint "${id}" not found.`);
    return row;
  }

  async updateComplaint(id: string, dto: UpdateComplaintDto) {
    await this.getComplaint(id);
    return this.prisma.patientComplaint.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : undefined,
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
        encounterId: dto.encounterId,
        departmentId: dto.departmentId,
        assignedToId: dto.assignedToId,
      },
      include: this.complaintInclude(),
    });
  }

  private complaintInclude() {
    return {
      patient: { select: patientNameFieldsSelect },
      department: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  // ─── Safety incidents ──────────────────────────────────────────────────────

  async createIncident(dto: CreateIncidentDto, staffId: string) {
    return this.prisma.safetyIncident.create({
      data: {
        patientId: dto.patientId,
        type: dto.type,
        description: dto.description,
        severity: dto.severity,
        rootCause: dto.rootCause,
        correctiveAction: dto.correctiveAction,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        departmentId: dto.departmentId,
        reportedById: staffId,
      },
      include: this.incidentInclude(),
    });
  }

  async listIncidents(q: QualitySafetyListQueryDto) {
    const { from, to } = this.listWindow(q);
    const where: Prisma.SafetyIncidentWhereInput = {
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.status
        ? { status: q.status as Prisma.EnumSafetyIncidentStatusFilter['equals'] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.safetyIncident.findMany({
        where,
        skip: q.skip ?? 0,
        take: q.take ?? 50,
        orderBy: { occurredAt: 'desc' },
        include: this.incidentInclude(),
      }),
      this.prisma.safetyIncident.count({ where }),
    ]);
    return { items, total };
  }

  async getIncident(id: string) {
    const row = await this.prisma.safetyIncident.findUnique({
      where: { id },
      include: this.incidentInclude(),
    });
    if (!row) throw new NotFoundException(`Safety incident "${id}" not found.`);
    return row;
  }

  async updateIncident(id: string, dto: UpdateIncidentDto) {
    await this.getIncident(id);
    return this.prisma.safetyIncident.update({
      where: { id },
      data: {
        type: dto.type,
        description: dto.description,
        severity: dto.severity,
        status: dto.status,
        rootCause: dto.rootCause,
        correctiveAction: dto.correctiveAction,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId,
        departmentId: dto.departmentId,
      },
      include: this.incidentInclude(),
    });
  }

  private incidentInclude() {
    return {
      patient: { select: patientNameFieldsSelect },
      department: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  // ─── Infection cases ───────────────────────────────────────────────────────

  async createInfection(dto: CreateInfectionDto, staffId: string) {
    return this.prisma.infectionCase.create({
      data: {
        patientId: dto.patientId,
        admissionId: dto.admissionId,
        type: dto.type,
        onsetDate: new Date(dto.onsetDate),
        organism: dto.organism,
        site: dto.site,
        isolated: dto.isolated ?? false,
        departmentId: dto.departmentId,
        createdById: staffId,
      },
      include: this.infectionInclude(),
    });
  }

  async listInfections(q: QualitySafetyListQueryDto) {
    const { from, to } = this.listWindow(q);
    const where: Prisma.InfectionCaseWhereInput = {
      ...(from || to
        ? {
            onsetDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.status
        ? { status: q.status as Prisma.EnumInfectionCaseStatusFilter['equals'] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.infectionCase.findMany({
        where,
        skip: q.skip ?? 0,
        take: q.take ?? 50,
        orderBy: { onsetDate: 'desc' },
        include: this.infectionInclude(),
      }),
      this.prisma.infectionCase.count({ where }),
    ]);
    return { items, total };
  }

  async getInfection(id: string) {
    const row = await this.prisma.infectionCase.findUnique({
      where: { id },
      include: this.infectionInclude(),
    });
    if (!row) throw new NotFoundException(`Infection case "${id}" not found.`);
    return row;
  }

  async updateInfection(id: string, dto: UpdateInfectionDto) {
    await this.getInfection(id);
    return this.prisma.infectionCase.update({
      where: { id },
      data: {
        type: dto.type,
        status: dto.status,
        organism: dto.organism,
        site: dto.site,
        isolated: dto.isolated,
        onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : undefined,
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
        departmentId: dto.departmentId,
      },
      include: this.infectionInclude(),
    });
  }

  private infectionInclude() {
    return {
      patient: { select: patientNameFieldsSelect },
      admission: { select: { id: true, admissionDateTime: true } },
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }
}
