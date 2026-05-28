import { Test, TestingModule } from '@nestjs/testing';
import { CmdCommunicationPriority } from '@prisma/client';
import { CmdAnalyticsService } from './cmd-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CmacOverviewService } from '../cmac-analytics/services/cmac-overview.service';
import { CmacPatientActivityService } from '../cmac-analytics/services/cmac-patient-activity.service';
import { CmacOperationsService } from '../cmac-analytics/services/cmac-operations.service';
import { CmacLaboratoryService } from '../cmac-analytics/services/cmac-laboratory.service';
import { CmacStaffService } from '../cmac-analytics/services/cmac-staff.service';

describe('CmdAnalyticsService', () => {
  it('maps broadcast priority to Prisma enum', async () => {
    const prisma = {
      cmdCommunication: {
        create: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmdAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CmacOverviewService, useValue: {} },
        { provide: CmacPatientActivityService, useValue: {} },
        { provide: CmacOperationsService, useValue: {} },
        { provide: CmacLaboratoryService, useValue: {} },
        { provide: CmacStaffService, useValue: {} },
      ],
    }).compile();

    const service = module.get(CmdAnalyticsService);
    await service.broadcast({
      title: 'Ops',
      body: 'Message',
      audience: 'all_staff',
      priority: 'high',
    });

    expect(prisma.cmdCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: CmdCommunicationPriority.HIGH,
        }),
      }),
    );
  });

  it('returns empty arrays for list endpoints', async () => {
    const prisma = {
      cmdReportTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      cmdCommunication: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmdAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CmacOverviewService, useValue: {} },
        { provide: CmacPatientActivityService, useValue: {} },
        { provide: CmacOperationsService, useValue: {} },
        { provide: CmacLaboratoryService, useValue: {} },
        { provide: CmacStaffService, useValue: {} },
      ],
    }).compile();
    const service = module.get(CmdAnalyticsService);
    await expect(service.reportTemplates()).resolves.toEqual([]);
    await expect(service.communications({})).resolves.toEqual([]);
  });
});
