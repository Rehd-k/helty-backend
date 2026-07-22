import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PregnancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type PregnancyClinicalContext = {
  pregnancyId: string;
  patientId: string;
  encounterId: string;
};

@Injectable()
export class PregnancyClinicalContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    pregnancyId: string,
    options?: { patientId?: string },
  ): Promise<PregnancyClinicalContext> {
    const pregnancy = await this.prisma.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: {
        id: true,
        patientId: true,
        encounterId: true,
        status: true,
      },
    });
    if (!pregnancy) {
      throw new NotFoundException(`Pregnancy "${pregnancyId}" not found.`);
    }
    if (!pregnancy.encounterId) {
      throw new BadRequestException(
        `Pregnancy "${pregnancyId}" has no linked antenatal encounter.`,
      );
    }
    if (pregnancy.status !== PregnancyStatus.ONGOING) {
      throw new BadRequestException(
        'This pregnancy is no longer ongoing; new clinical orders are not allowed.',
      );
    }
    if (options?.patientId && options.patientId !== pregnancy.patientId) {
      throw new BadRequestException(
        'Patient does not match the pregnancy record.',
      );
    }
    return {
      pregnancyId: pregnancy.id,
      patientId: pregnancy.patientId,
      encounterId: pregnancy.encounterId,
    };
  }
}
