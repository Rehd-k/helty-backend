import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { cascadeDeleteLabTests } from '../lab-catalog-cascade.util';
import {
  ImportLabConfigDto,
  LAB_CONFIG_FORMAT,
  LAB_CONFIG_VERSION,
} from './dto/import-lab-config.dto';

@Injectable()
export class LabConfigTransferService {
  constructor(private readonly prisma: PrismaService) {}

  async exportConfig() {
    const [categories, antibiotics, astResultOptions] = await Promise.all([
      this.prisma.labCategory.findMany({
        orderBy: { name: 'asc' },
        include: {
          tests: {
            orderBy: { name: 'asc' },
            include: {
              versions: {
                orderBy: { versionNumber: 'asc' },
                include: {
                  fields: {
                    orderBy: [{ position: 'asc' }, { label: 'asc' }],
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.labAntibiotic.findMany({
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.labAstResultOption.findMany({
        orderBy: [{ position: 'asc' }, { label: 'asc' }],
      }),
    ]);

    return {
      format: LAB_CONFIG_FORMAT,
      version: LAB_CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        tests: category.tests.map((test) => ({
          id: test.id,
          name: test.name,
          sampleType: test.sampleType,
          description: test.description,
          price: test.price,
          isActive: test.isActive,
          versions: test.versions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            isActive: version.isActive,
            fields: version.fields.map((field) => ({
              id: field.id,
              label: field.label,
              fieldType: field.fieldType,
              unit: field.unit,
              referenceRange: field.referenceRange,
              required: field.required,
              position: field.position,
              optionsJson: field.optionsJson,
            })),
          })),
        })),
      })),
      antibiotics: antibiotics.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        isActive: row.isActive,
        position: row.position,
      })),
      astResultOptions: astResultOptions.map((row) => ({
        id: row.id,
        label: row.label,
        code: row.code,
        isActive: row.isActive,
        position: row.position,
      })),
    };
  }

  async importConfig(dto: ImportLabConfigDto) {
    this.assertNoDuplicateIds(dto);

    const summary = await this.prisma.$transaction(
      async (tx) => {
        await tx.labAstResult.deleteMany();
        await tx.labAntibiotic.deleteMany();
        await tx.labAstResultOption.deleteMany();

        const existingTests = await tx.labTest.findMany({ select: { id: true } });
        const cascade = await cascadeDeleteLabTests(
          tx,
          existingTests.map((t) => t.id),
        );
        await tx.labCategory.deleteMany();

        if (dto.antibiotics.length > 0) {
          await tx.labAntibiotic.createMany({
            data: dto.antibiotics.map((row) => ({
              id: row.id,
              name: row.name.trim(),
              code: row.code?.trim() || null,
              isActive: row.isActive ?? true,
              position: row.position ?? 0,
            })),
          });
        }

        if (dto.astResultOptions.length > 0) {
          await tx.labAstResultOption.createMany({
            data: dto.astResultOptions.map((row) => ({
              id: row.id,
              label: row.label.trim(),
              code: row.code?.trim() || null,
              isActive: row.isActive ?? true,
              position: row.position ?? 0,
            })),
          });
        }

        let createdCategories = 0;
        let createdTests = 0;
        let createdVersions = 0;
        let createdFields = 0;

        for (const category of dto.categories) {
          await tx.labCategory.create({
            data: {
              id: category.id,
              name: category.name.trim(),
              description: category.description?.trim() || null,
            },
          });
          createdCategories += 1;

          for (const test of category.tests) {
            await tx.labTest.create({
              data: {
                id: test.id,
                name: test.name.trim(),
                categoryId: category.id,
                sampleType: test.sampleType.trim(),
                description: test.description?.trim() || null,
                price: test.price ?? null,
                isActive: test.isActive ?? true,
              },
            });
            createdTests += 1;

            for (const version of test.versions) {
              await tx.labTestVersion.create({
                data: {
                  id: version.id,
                  testId: test.id,
                  versionNumber: version.versionNumber,
                  isActive: version.isActive ?? false,
                },
              });
              createdVersions += 1;

              if (version.fields.length > 0) {
                await tx.labTestField.createMany({
                  data: version.fields.map((field) => ({
                    id: field.id,
                    testVersionId: version.id,
                    label: field.label.trim(),
                    fieldType: field.fieldType,
                    unit: field.unit?.trim() || null,
                    referenceRange: field.referenceRange?.trim() || null,
                    required: field.required ?? false,
                    position: field.position ?? 0,
                    optionsJson: field.optionsJson ?? null,
                  })),
                });
                createdFields += version.fields.length;
              }
            }
          }
        }

        return {
          cascade,
          created: {
            categories: createdCategories,
            tests: createdTests,
            versions: createdVersions,
            fields: createdFields,
            antibiotics: dto.antibiotics.length,
            astResultOptions: dto.astResultOptions.length,
          },
        };
      },
      { timeout: 120_000 },
    );

    return {
      ok: true,
      format: LAB_CONFIG_FORMAT,
      version: LAB_CONFIG_VERSION,
      ...summary,
    };
  }

  private assertNoDuplicateIds(dto: ImportLabConfigDto) {
    const track = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          throw new BadRequestException(`Duplicate ${label} id: ${id}`);
        }
        seen.add(id);
      }
    };

    const categoryIds: string[] = [];
    const testIds: string[] = [];
    const versionIds: string[] = [];
    const fieldIds: string[] = [];

    for (const category of dto.categories) {
      categoryIds.push(category.id);
      for (const test of category.tests) {
        testIds.push(test.id);
        for (const version of test.versions) {
          versionIds.push(version.id);
          for (const field of version.fields) {
            fieldIds.push(field.id);
          }
        }
      }
    }

    track('category', categoryIds);
    track('test', testIds);
    track('version', versionIds);
    track('field', fieldIds);
    track(
      'antibiotic',
      dto.antibiotics.map((row) => row.id),
    );
    track(
      'astResultOption',
      dto.astResultOptions.map((row) => row.id),
    );

    const antibioticNames = new Set<string>();
    for (const row of dto.antibiotics) {
      const name = row.name.trim().toLowerCase();
      if (antibioticNames.has(name)) {
        throw new BadRequestException(
          `Duplicate antibiotic name: ${row.name.trim()}`,
        );
      }
      antibioticNames.add(name);
    }

    const optionLabels = new Set<string>();
    for (const row of dto.astResultOptions) {
      const label = row.label.trim().toLowerCase();
      if (optionLabels.has(label)) {
        throw new BadRequestException(
          `Duplicate AST option label: ${row.label.trim()}`,
        );
      }
      optionLabels.add(label);
    }
  }
}
