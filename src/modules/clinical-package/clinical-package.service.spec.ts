import { ClinicalPackageService } from './clinical-package.service';
import { PregnancyStatus } from '@prisma/client';

describe('ClinicalPackageService', () => {
  const prisma = {
    clinicalServicePackage: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'pkg-1', name: 'ANC' }),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    clinicalServicePackageItem: {
      findFirst: jest.fn(),
    },
    pregnancy: {
      findFirst: jest.fn(),
    },
    service: { findUnique: jest.fn() },
    drug: { findUnique: jest.fn() },
  };

  let service: ClinicalPackageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClinicalPackageService(prisma as any);
  });

  it('resolveAntenatalPackageItemForService returns item when patient has ongoing pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValue({ id: 'preg-1' });
    prisma.clinicalServicePackage.findFirst
      .mockResolvedValueOnce({ id: 'pkg-1' })
      .mockResolvedValueOnce({ id: 'pkg-1' });
    prisma.clinicalServicePackageItem.findFirst.mockResolvedValue({
      id: 'item-1',
      serviceId: 'svc-1',
    });

    const result = await service.resolveAntenatalPackageItemForService(
      'pat-1',
      'svc-1',
    );

    expect(result).toEqual({
      packageId: 'pkg-1',
      packageItemId: 'item-1',
      serviceId: 'svc-1',
    });
    expect(prisma.pregnancy.findFirst).toHaveBeenCalledWith({
      where: { patientId: 'pat-1', status: PregnancyStatus.ONGOING },
      select: { id: true },
    });
  });

  it('resolveAntenatalPackageItemForService returns null without ongoing pregnancy', async () => {
    prisma.pregnancy.findFirst.mockResolvedValue(null);

    const result = await service.resolveAntenatalPackageItemForService(
      'pat-1',
      'svc-1',
    );

    expect(result).toBeNull();
  });
});
