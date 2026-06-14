import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEncounterTemplateDto,
  QueryEncounterTemplateDto,
  UpdateEncounterTemplateDto,
} from './dto/encounter-template.dto';

const templateInclude = {
  doctor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      staffId: true,
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  updatedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.EncounterTemplateInclude;

@Injectable()
export class EncounterTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEncounterTemplateDto, staffId: string) {
    await this.assertUniqueName(staffId, dto.name.trim());

    return this.prisma.encounterTemplate.create({
      data: {
        ...this.toTemplateData(dto),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        doctorId: staffId,
        createdById: staffId,
        updatedById: staffId,
      },
      include: templateInclude,
    });
  }

  async findAll(staffId: string, query: QueryEncounterTemplateDto) {
    const where: Prisma.EncounterTemplateWhereInput = {
      doctorId: staffId,
      ...(query.encounterType ? { encounterType: query.encounterType } : {}),
    };

    const templates = await this.prisma.encounterTemplate.findMany({
      where,
      include: templateInclude,
      orderBy: [{ name: 'asc' }],
    });

    return { templates, total: templates.length };
  }

  async findOne(id: string, staffId: string) {
    const template = await this.prisma.encounterTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    if (!template) {
      throw new NotFoundException(`Encounter template "${id}" not found.`);
    }
    this.assertOwner(template.doctorId, staffId);
    return template;
  }

  async update(
    id: string,
    dto: UpdateEncounterTemplateDto,
    staffId: string,
  ) {
    const existing = await this.prisma.encounterTemplate.findUnique({
      where: { id },
      select: { id: true, doctorId: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException(`Encounter template "${id}" not found.`);
    }
    this.assertOwner(existing.doctorId, staffId);

    if (dto.name?.trim() && dto.name.trim() !== existing.name) {
      await this.assertUniqueName(existing.doctorId, dto.name.trim(), id);
    }

    return this.prisma.encounterTemplate.update({
      where: { id },
      data: {
        ...this.toTemplateData(dto),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        updatedById: staffId,
      },
      include: templateInclude,
    });
  }

  async remove(id: string, staffId: string) {
    const existing = await this.prisma.encounterTemplate.findUnique({
      where: { id },
      select: { id: true, doctorId: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException(`Encounter template "${id}" not found.`);
    }
    this.assertOwner(existing.doctorId, staffId);

    await this.prisma.encounterTemplate.delete({ where: { id } });
    return { id, name: existing.name, deleted: true };
  }

  private assertOwner(doctorId: string, staffId: string) {
    if (doctorId !== staffId) {
      throw new ForbiddenException(
        'You can only access your own encounter templates.',
      );
    }
  }

  private async assertUniqueName(
    doctorId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.encounterTemplate.findFirst({
      where: {
        doctorId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `You already have an encounter template named "${name}".`,
      );
    }
  }

  private toTemplateData(
    dto: CreateEncounterTemplateDto | UpdateEncounterTemplateDto,
  ): Omit<
    Prisma.EncounterTemplateUncheckedCreateInput,
    'name' | 'description' | 'doctorId' | 'createdById' | 'updatedById'
  > {
    const data: Omit<
      Prisma.EncounterTemplateUncheckedCreateInput,
      'name' | 'description' | 'doctorId' | 'createdById' | 'updatedById'
    > = {};

    const assign = <
      K extends keyof Omit<
        Prisma.EncounterTemplateUncheckedCreateInput,
        'name' | 'description' | 'doctorId' | 'createdById' | 'updatedById'
      >,
    >(
      key: K,
      value:
        | Omit<
            Prisma.EncounterTemplateUncheckedCreateInput,
            'name' | 'description' | 'doctorId' | 'createdById' | 'updatedById'
          >[K]
        | undefined,
    ) => {
      if (value !== undefined) {
        data[key] = value;
      }
    };

    assign('encounterType', dto.encounterType);
    assign('chiefComplaint', dto.chiefComplaint);
    assign('hpi', dto.hpi);
    assign('pmh', dto.pmh);
    assign('surgicalHistory', dto.surgicalHistory);
    assign('drugHistory', dto.drugHistory);
    assign('allergyHistory', dto.allergyHistory);
    assign('familyHistory', dto.familyHistory);
    assign('socialHistory', dto.socialHistory);
    assign('examinationNotes', dto.examinationNotes);
    assign('soapSubjective', dto.soapSubjective);
    assign('soapObjective', dto.soapObjective);
    assign('soapAssessment', dto.soapAssessment);
    assign('soapPlan', dto.soapPlan);
    assign('triageNotes', dto.triageNotes);
    assign('visitType', dto.visitType);
    assign('primaryIcdCode', dto.primaryIcdCode);
    assign('primaryIcdDescription', dto.primaryIcdDescription);
    assign('secondaryDiagnosesJson', dto.secondaryDiagnosesJson);
    assign('proceduresJson', dto.proceduresJson);
    assign('specialtyModulesJson', dto.specialtyModulesJson);
    assign('clinicalSectionsJson', dto.clinicalSectionsJson);
    assign('followUpDate', dto.followUpDate);
    assign('followUpInstructions', dto.followUpInstructions);
    assign('referral', dto.referral);

    return data;
  }
}
