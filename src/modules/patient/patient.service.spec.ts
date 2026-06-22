import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: () => 'TESTIDAB',
}));

import { PatientService } from './patient.service';

describe('PatientService.remove', () => {
  const prisma = {
    patient: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: PatientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientService(prisma as any);
  });

  it('throws NotFoundException when patient does not exist', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes patient when no linked records block removal', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.patient.delete.mockResolvedValue({ id: 'p-1' });

    await service.remove('p-1');

    expect(prisma.patient.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
  });

  it('throws ConflictException when foreign key constraints block delete', async () => {
    prisma.patient.findUnique.mockResolvedValue({ id: 'p-1' });
    prisma.patient.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(service.remove('p-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
