import { Test, TestingModule } from '@nestjs/testing';
import { CmacPatientActivityService } from './cmac-patient-activity.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseCmacPeriod } from '../cmac-analytics.helpers';

describe('CmacPatientActivityService OPD visits', () => {
  it('counts distinct patients with paid consultation invoices', async () => {
    const prisma = {
      patient: { count: jest.fn().mockResolvedValue(100) },
      invoiceItem: {
        findMany: jest.fn().mockResolvedValue([
          { invoice: { patientId: 'p1' } },
          { invoice: { patientId: 'p1' } },
          { invoice: { patientId: 'p2' } },
        ]),
      },
      admission: { count: jest.fn().mockResolvedValue(0) },
      referral: { count: jest.fn().mockResolvedValue(0) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmacPatientActivityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get(CmacPatientActivityService);
    const ctx = parseCmacPeriod('week');
    const report = await service.getReport(ctx);
    const opd = report.kpis.find((k) => k.key === 'opdVisits');
    expect(opd?.value).toBe(2);
  });
});
