import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EncounterTemplateService } from './encounter-template.service';

describe('EncounterTemplateService', () => {
  const staffId = 'doc-1';
  const templateId = 'tpl-1';

  const prisma = {
    encounterTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: EncounterTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EncounterTemplateService(prisma as any);
  });

  it('creates a template for the authenticated doctor', async () => {
    prisma.encounterTemplate.findFirst.mockResolvedValue(null);
    prisma.encounterTemplate.create.mockResolvedValue({
      id: templateId,
      name: 'Hypertension follow-up',
      doctorId: staffId,
    });

    const result = await service.create(
      { name: 'Hypertension follow-up', hpi: 'Known HTN' },
      staffId,
    );

    expect(prisma.encounterTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Hypertension follow-up',
          doctorId: staffId,
          createdById: staffId,
          hpi: 'Known HTN',
        }),
      }),
    );
    expect(result.name).toBe('Hypertension follow-up');
  });

  it('rejects duplicate template names for the same doctor', async () => {
    prisma.encounterTemplate.findFirst.mockResolvedValue({ id: 'other' });

    await expect(
      service.create({ name: 'Duplicate' }, staffId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('scopes list queries to the authenticated doctor', async () => {
    prisma.encounterTemplate.findMany.mockResolvedValue([]);

    await service.findAll(staffId, {});

    expect(prisma.encounterTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { doctorId: staffId },
      }),
    );
  });

  it('forbids access to another doctor template', async () => {
    prisma.encounterTemplate.findUnique.mockResolvedValue({
      id: templateId,
      doctorId: 'other-doc',
    });

    await expect(service.findOne(templateId, staffId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deletes owned templates', async () => {
    prisma.encounterTemplate.findUnique.mockResolvedValue({
      id: templateId,
      doctorId: staffId,
      name: 'To delete',
    });
    prisma.encounterTemplate.delete.mockResolvedValue({ id: templateId });

    const result = await service.remove(templateId, staffId);

    expect(result).toEqual({
      id: templateId,
      name: 'To delete',
      deleted: true,
    });
  });

  it('throws when deleting a missing template', async () => {
    prisma.encounterTemplate.findUnique.mockResolvedValue(null);

    await expect(service.remove(templateId, staffId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
