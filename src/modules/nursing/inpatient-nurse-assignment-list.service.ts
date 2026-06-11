import { ForbiddenException, Injectable } from '@nestjs/common';
import { NursingUnit, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  loadNursingActor,
  wardMatchesNursingUnit,
} from './nursing-scope.utils';
import { QueryInpatientNurseAssignmentDto } from './dto/inpatient-assignment-query.dto';
import { isMatronRole, staffRoleToNursingUnit } from './nursing.constants';

@Injectable()
export class InpatientNurseAssignmentListService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorId: string, query: QueryInpatientNurseAssignmentDto) {
    const actor = await loadNursingActor(this.prisma, actorId);

    if (
      !isMatronRole(actor.staffRole) &&
      !staffRoleToNursingUnit(actor.staffRole)
    ) {
      throw new ForbiddenException(
        'Only charge nurses or the matron may list inpatient assignments.',
      );
    }

    const where: Prisma.NurseAssignmentWhereInput = {};

    if (query.shiftDate) {
      const d = new Date(query.shiftDate);
      d.setUTCHours(0, 0, 0, 0);
      where.shiftDate = d;
    }
    if (query.shiftType) where.shiftType = query.shiftType;
    if (query.nursingUnit) where.nursingUnit = query.nursingUnit;

    const admissionWhere: Prisma.AdmissionWhereInput = {};
    if (query.wardId) {
      admissionWhere.wardId = query.wardId;
    }

    if (Object.keys(admissionWhere).length) {
      where.admission = admissionWhere;
    }

    let rows = await this.prisma.nurseAssignment.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { shiftType: 'asc' }],
      include: {
        nurse: {
          select: { id: true, firstName: true, lastName: true, staffRole: true },
        },
        assignedBy: {
          select: { id: true, firstName: true, lastName: true, staffRole: true },
        },
        admission: {
          select: {
            id: true,
            status: true,
            wardId: true,
            wardEntity: {
              select: {
                id: true,
                name: true,
                type: true,
                department: { select: { name: true } },
              },
            },
            patient: {
              select: {
                id: true,
                firstName: true,
                surname: true,
                patientId: true,
              },
            },
          },
        },
      },
    });

    const actorUnit = staffRoleToNursingUnit(actor.staffRole);
    if (!isMatronRole(actor.staffRole) && actorUnit) {
      rows = rows.filter((row) => {
        const ward = row.admission.wardEntity;
        if (!ward) return actorUnit === NursingUnit.INPATIENT_WARD;
        return wardMatchesNursingUnit(ward, actorUnit);
      });
    }

    return rows;
  }
}
