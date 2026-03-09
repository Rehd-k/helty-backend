import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLabTestVersionDto } from './dto/create-version.dto';

@Injectable()
export class LabTestVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(testId: string, dto: CreateLabTestVersionDto = {}) {
    const test = await this.prisma.labTest.findUnique({
      where: { id: testId },
      include: { versions: true },
    });
    if (!test) {
      throw new NotFoundException(`Lab test "${testId}" not found.`);
    }

    const nextVersion =
      test.versions.length === 0
        ? 1
        : Math.max(...test.versions.map((v) => v.versionNumber)) + 1;

    const setActive = dto.setActive !== false;

    if (setActive) {
      await this.prisma.labTestVersion.updateMany({
        where: { testId },
        data: { isActive: false },
      });
    }

    return this.prisma.labTestVersion.create({
      data: {
        testId,
        versionNumber: nextVersion,
        isActive: setActive,
      },
      include: { test: { select: { id: true, name: true } } },
    });
  }

  async findAllByTestId(testId: string) {
    const test = await this.prisma.labTest.findUnique({
      where: { id: testId },
    });
    if (!test) {
      throw new NotFoundException(`Lab test "${testId}" not found.`);
    }
    return this.prisma.labTestVersion.findMany({
      where: { testId },
      orderBy: { versionNumber: 'desc' },
      include: {
        _count: { select: { fields: true, orderItems: true } },
      },
    });
  }

  async findOne(id: string) {
    const version = await this.prisma.labTestVersion.findUnique({
      where: { id },
      include: {
        test: true,
        fields: { orderBy: { position: 'asc' } },
      },
    });
    if (!version) {
      throw new NotFoundException(`Lab test version "${id}" not found.`);
    }
    return version;
  }
}
