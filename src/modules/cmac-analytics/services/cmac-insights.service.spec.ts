import { Test, TestingModule } from '@nestjs/testing';
import { CmacInsightsService } from './cmac-insights.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CmacClinicalService } from './cmac-clinical.service';
import { CmacLaboratoryService } from './cmac-laboratory.service';
import { CmacPharmacyService } from './cmac-pharmacy.service';
import { CmacOperationsService } from './cmac-operations.service';
import { CmacQualityService } from './cmac-quality.service';
import { parseCmacPeriod } from '../cmac-analytics.helpers';

describe('CmacInsightsService', () => {
  let service: CmacInsightsService;

  const labReport = {
    kpis: [{ key: 'medianTatHours', value: 18, comparison: {} }],
    criticalAlerts: [],
    statusBreakdown: [],
    topTests: [],
    pendingVsCompleted: { pending: 0, completed: 0 },
  };

  const pharmReport = {
    kpis: [
      {
        key: 'antibioticUnits',
        value: 100,
        comparison: { percentChange: 25, direction: 'up' },
      },
      { key: 'stockouts', value: 2, comparison: {} },
    ],
    topPrescribed: [],
    antibioticTrend: [],
  };

  const opsReport = {
    kpis: [],
    departmentUtilization: [{ name: 'General OPD', count: 120 }],
    peakVisitingHours: [{ label: '09:00', value: 40, start: '', end: '' }],
    doctorWorkload: [],
  };

  const clinicalReport = {
    kpis: [],
    readmissions: { current: { rate: 12, readmissions: 1, totalDischarges: 8 }, previous: {} },
    topDiagnoses: [],
    treatmentOutcomes: { current: [], previous: [] },
  };

  const qualityReport = {
    kpis: [],
    auditFlags: Array.from({ length: 6 }, (_, i) => ({
      entityType: 'Encounter',
      entityId: `e${i}`,
      patientId: 'p1',
      rule: 'MISSING_DIAGNOSIS',
      severity: 'warning' as const,
    })),
    incidentsByType: [],
    complaintsByCategory: [],
    criticalIncidents: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmacInsightsService,
        { provide: PrismaService, useValue: { invoiceItem: { findMany: jest.fn().mockResolvedValue([]) } } },
        {
          provide: CmacClinicalService,
          useValue: { getReport: jest.fn().mockResolvedValue(clinicalReport) },
        },
        {
          provide: CmacLaboratoryService,
          useValue: { getReport: jest.fn().mockResolvedValue(labReport) },
        },
        {
          provide: CmacPharmacyService,
          useValue: { getReport: jest.fn().mockResolvedValue(pharmReport) },
        },
        {
          provide: CmacOperationsService,
          useValue: { getReport: jest.fn().mockResolvedValue(opsReport) },
        },
        {
          provide: CmacQualityService,
          useValue: { getReport: jest.fn().mockResolvedValue(qualityReport) },
        },
      ],
    }).compile();
    service = module.get(CmacInsightsService);
  });

  it('orders insights with critical before warning', async () => {
    const ctx = parseCmacPeriod('week');
    const insights = await service.generate(ctx, 10);
    expect(insights.length).toBeGreaterThan(0);
    const firstCritical = insights.findIndex((i) => i.severity === 'critical');
    const firstWarning = insights.findIndex((i) => i.severity === 'warning');
    if (firstCritical >= 0 && firstWarning >= 0) {
      expect(firstCritical).toBeLessThan(firstWarning);
    }
    expect(insights.some((i) => i.message.includes('Lab results'))).toBe(true);
  });
});
