import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LabTestFieldType, Prisma } from '@prisma/client';
import { isValidReferenceRange } from '../lab-reference-range.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabTestFieldDto } from './dto/create-lab-test-field.dto';
import { UpdateLabTestFieldDto } from './dto/update-lab-test-field.dto';

@Injectable()
export class LabTestFieldService {
  constructor(private readonly prisma: PrismaService) {}

  private assertReferenceRangeForField(
    fieldType: LabTestFieldType,
    referenceRange?: string | null,
  ) {
    if (fieldType !== LabTestFieldType.NUMBER) return;
    if (referenceRange == null || !referenceRange.trim()) return;
    if (!isValidReferenceRange(referenceRange)) {
      throw new BadRequestException(
        'referenceRange must be a supported format for NUMBER fields (e.g. "80-120", "<1.2", ">5", "<=10", ">=5").',
      );
    }
  }

  async create(dto: CreateLabTestFieldDto) {
    const version = await this.prisma.labTestVersion.findUnique({
      where: { id: dto.testVersionId },
    });
    if (!version) {
      throw new NotFoundException(
        `Lab test version "${dto.testVersionId}" not found.`,
      );
    }
    this.assertReferenceRangeForField(dto.fieldType, dto.referenceRange);
    return this.prisma.labTestField.create({
      data: {
        testVersionId: dto.testVersionId,
        label: dto.label,
        fieldType: dto.fieldType,
        unit: dto.unit,
        referenceRange: dto.referenceRange,
        required: dto.required ?? false,
        position: dto.position ?? 0,
        optionsJson: dto.optionsJson,
      },
      include: {
        testVersion: {
          select: { id: true, versionNumber: true, testId: true },
        },
      },
    });
  }

  async findAllByVersionId(versionId: string) {
    const version = await this.prisma.labTestVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException(`Lab test version "${versionId}" not found.`);
    }
    return this.prisma.labTestField.findMany({
      where: { testVersionId: versionId },
      orderBy: { position: 'asc' },
    });
  }

  async update(id: string, dto: UpdateLabTestFieldDto) {
    const field = await this.prisma.labTestField.findUnique({
      where: { id },
    });
    if (!field) {
      throw new NotFoundException(`Lab test field "${id}" not found.`);
    }
    if (
      dto.testVersionId !== undefined &&
      dto.testVersionId !== field.testVersionId
    ) {
      const version = await this.prisma.labTestVersion.findUnique({
        where: { id: dto.testVersionId },
      });
      if (!version) {
        throw new NotFoundException(
          `Lab test version "${dto.testVersionId}" not found.`,
        );
      }
    }
    const fieldType = dto.fieldType ?? field.fieldType;
    const referenceRange =
      dto.referenceRange !== undefined
        ? dto.referenceRange
        : field.referenceRange;
    this.assertReferenceRangeForField(fieldType, referenceRange);
    return this.prisma.labTestField.update({
      where: { id },
      data: dto,
      include: {
        testVersion: {
          select: { id: true, versionNumber: true, testId: true },
        },
      },
    });
  }

  async remove(id: string) {
    const field = await this.prisma.labTestField.findUnique({
      where: { id },
    });
    if (!field) {
      throw new NotFoundException(`Lab test field "${id}" not found.`);
    }
    try {
      await this.prisma.labTestField.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ConflictException(
          `Cannot delete lab test field "${id}" while results reference it.`,
        );
      }
      throw e;
    }
  }
}
