import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NursingUnit, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTargetStaffIsNurseOrThrow } from '../inpatient-nursing/inpatient-nursing.utils';
import {
  assertCanManageOutpatientUnit,
  assertInvoiceInNursingQueue,
  loadNursingActor,
  NursingActor,
} from './nursing-scope.utils';
import { isMatronRole, staffRoleToNursingUnit } from './nursing.constants';
import {
  CreateOutpatientNurseAssignmentDto,
  QueryOutpatientNurseAssignmentDto,
} from './dto/outpatient-assignment.dto';
const assignmentInclude = {
  nurse: {
    select: { id: true, firstName: true, lastName: true, staffRole: true },
  },
  invoice: {
    select: {
      id: true,
      invoiceID: true,
      status: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          surname: true,
          patientId: true,
        },
      },
      consultingRoom: { select: { id: true, name: true } },
      vitals: true,
    },
  },
  assignedBy: {
    select: { id: true, firstName: true, lastName: true, staffRole: true },
  },
} as const;

@Injectable()
export class OutpatientNurseAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(
    actor: NursingActor,
    query: QueryOutpatientNurseAssignmentDto,
  ): Prisma.OutpatientNurseAssignmentWhereInput {
    const where: Prisma.OutpatientNurseAssignmentWhereInput = {};

    if (query.nursingUnit) {
      where.nursingUnit = query.nursingUnit;
    } else if (!isMatronRole(actor.staffRole)) {
      const unit = staffRoleToNursingUnit(actor.staffRole);
      if (unit === NursingUnit.OPD || unit === NursingUnit.ONG) {
        where.nursingUnit = unit;
      }
    }

    if (query.nurseId) {
      where.nurseId = query.nurseId;
    }

    return where;
  }

  async list(actorId: string, query: QueryOutpatientNurseAssignmentDto) {
    const actor = await loadNursingActor(this.prisma, actorId);

    if (
      !isMatronRole(actor.staffRole) &&
      !staffRoleToNursingUnit(actor.staffRole)
    ) {
      const isLineNurse =
        actor.staffRole === 'OUTPATIENT_NURSE' ||
        actor.staffRole === 'INPATIENT_NURSE';
      if (isLineNurse) {
        query.nurseId = actorId;
      } else {
        throw new ForbiddenException(
          'You may not view outpatient nurse assignments.',
        );
      }
    }

    return this.prisma.outpatientNurseAssignment.findMany({
      where: this.scopeWhere(actor, query),
      orderBy: { assignedAt: 'desc' },
      include: assignmentInclude,
    });
  }

  async create(actorId: string, dto: CreateOutpatientNurseAssignmentDto) {
    const actor = await loadNursingActor(this.prisma, actorId);
    await assertCanManageOutpatientUnit(actor, dto.nursingUnit);
    await assertInvoiceInNursingQueue(this.prisma, dto.invoiceId);
    await assertTargetStaffIsNurseOrThrow(this.prisma, dto.nurseId);

    let shiftDate: Date | undefined;
    if (dto.shiftDate) {
      shiftDate = new Date(dto.shiftDate);
      shiftDate.setUTCHours(0, 0, 0, 0);
    }

    try {
      return await this.prisma.outpatientNurseAssignment.create({
        data: {
          nurseId: dto.nurseId,
          invoiceId: dto.invoiceId,
          nursingUnit: dto.nursingUnit,
          assignedById: actorId,
          shiftDate,
          shiftType: dto.shiftType,
        },
        include: assignmentInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This queue entry already has a nurse assignment.',
        );
      }
      throw e;
    }
  }

  async remove(actorId: string, assignmentId: string) {
    const actor = await loadNursingActor(this.prisma, actorId);
    const row = await this.prisma.outpatientNurseAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!row) throw new NotFoundException('Assignment not found.');

    await assertCanManageOutpatientUnit(actor, row.nursingUnit);

    await this.prisma.outpatientNurseAssignment.delete({
      where: { id: assignmentId },
    });
  }
}
