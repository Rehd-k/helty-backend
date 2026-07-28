import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  formatPatientDisplayName,
  patientNameFieldsSelect,
} from '../../common/utils/patient-display-name.util';
import { PrismaService } from '../../prisma/prisma.service';
import { LinkChildDto } from './dto/link-child.dto';
import { staffBriefSelect } from '../../common/constants/staff-select.constants';

@Injectable()
export class FrontdeskFamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async listChildren(parentPatientId: string) {
    await this.assertPatientExists(parentPatientId);

    const links = await this.prisma.patientFamilyLink.findMany({
      where: { parentPatientId },
      orderBy: { createdAt: 'desc' },
      include: {
        child: {
          select: patientNameFieldsSelect,
        },
        createdBy: { select: staffBriefSelect },
      },
    });

    return {
      data: links.map((link) => ({
        id: link.id,
        linkedAt: link.createdAt,
        child: {
          id: link.child.id,
          patientId: link.child.patientId,
          displayName: formatPatientDisplayName(link.child),
          dob: link.child.dob,
          gender: link.child.gender,
          avatarUrl: link.child.avatarUrl ?? null,
        },
        createdBy: link.createdBy,
      })),
    };
  }

  async linkChild(
    parentPatientId: string,
    dto: LinkChildDto,
    staffId: string,
  ) {
    if (parentPatientId === dto.childPatientId) {
      throw new BadRequestException('Cannot link a patient as their own child');
    }

    await this.assertPatientExists(parentPatientId);
    await this.assertPatientExists(dto.childPatientId);

    const reverse = await this.prisma.patientFamilyLink.findUnique({
      where: {
        parentPatientId_childPatientId: {
          parentPatientId: dto.childPatientId,
          childPatientId: parentPatientId,
        },
      },
    });
    if (reverse) {
      throw new BadRequestException(
        'Cannot create a circular parent-child relationship',
      );
    }

    try {
      const link = await this.prisma.patientFamilyLink.create({
        data: {
          parentPatientId,
          childPatientId: dto.childPatientId,
          createdById: staffId,
        },
        include: {
          child: {
            select: patientNameFieldsSelect,
          },
        },
      });

      return {
        id: link.id,
        linkedAt: link.createdAt,
        child: {
          id: link.child.id,
          patientId: link.child.patientId,
          displayName: formatPatientDisplayName(link.child),
          dob: link.child.dob,
          gender: link.child.gender,
          avatarUrl: link.child.avatarUrl ?? null,
        },
      };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Child is already linked to this parent');
      }
      throw err;
    }
  }

  async unlinkChild(parentPatientId: string, childPatientId: string) {
    const existing = await this.prisma.patientFamilyLink.findUnique({
      where: {
        parentPatientId_childPatientId: {
          parentPatientId,
          childPatientId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Family link not found');
    }
    await this.prisma.patientFamilyLink.delete({
      where: { id: existing.id },
    });
    return { removed: true };
  }

  private async assertPatientExists(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
  }
}
