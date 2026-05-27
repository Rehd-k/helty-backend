import { Test, TestingModule } from '@nestjs/testing';
import { CmacClinicalService } from './cmac-clinical.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseCmacPeriod } from '../cmac-analytics.helpers';

describe('CmacClinicalService', () => {
  let service: CmacClinicalService;
  const prisma = {
    encounterDiagnosis: { groupBy: jest.fn() },
    icd10Code: { findMany: jest.fn() },
    admission: { groupBy: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmacClinicalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CmacClinicalService);
    jest.clearAllMocks();
  });

  it('computes readmission rate from discharges', async () => {
    const d1 = new Date('2026-05-01T10:00:00Z');
    const d2 = new Date('2026-05-10T10:00:00Z');
    prisma.admission.findMany
      .mockResolvedValueOnce([
        { patientId: 'p1', dischargeDateTime: d1 },
        { patientId: 'p2', dischargeDateTime: d2 },
      ])
      .mockResolvedValue([]);
    prisma.admission.findFirst
      .mockResolvedValueOnce({ id: 'readmit' })
      .mockResolvedValueOnce(null);
    prisma.encounterDiagnosis.groupBy.mockResolvedValue([]);
    prisma.icd10Code.findMany.mockResolvedValue([]);
    prisma.admission.groupBy.mockResolvedValue([]);

    const ctx = parseCmacPeriod('month', '2026-05-20T00:00:00Z');
    const report = await service.getReport(ctx, 5);
    expect(report.readmissions.current.totalDischarges).toBe(2);
    expect(report.readmissions.current.readmissions).toBe(1);
    expect(report.readmissions.current.rate).toBe(50);
  });
});
