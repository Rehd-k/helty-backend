import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabTestFieldDto } from './dto/create-lab-test-field.dto';

@Injectable()
export class LabTestFieldService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLabTestFieldDto) {
    const version = await this.prisma.labTestVersion.findUnique({
      where: { id: dto.testVersionId },
    });
    if (!version) {
      throw new NotFoundException(
        `Lab test version "${dto.testVersionId}" not found.`,
      );
    }
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
}
