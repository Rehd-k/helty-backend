import { NotFoundException } from '@nestjs/common';
import { LabAbnormalFlag, LabOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientFamilyService } from '../patient-family/patient-family.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { LabSummaryStatus } from './dto/lab-report-response.dto';
import { PatientLabReportsService } from './patient-lab-reports.service';

describe('PatientLabReportsService', () => {
  const prisma = {
    labOrder: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const family = {
    resolveSubjectPatientId: jest
      .fn()
      .mockImplementation(async (user: PatientJwtPayload, forPatientId?: string) =>
        forPatientId?.trim() || user.sub,
      ),
  } as unknown as PatientFamilyService;

  const service = new PatientLabReportsService(prisma, family);

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
    deviceId: 'device-1',
  };

  const listOrder = {
    id: 'order-1',
    status: LabOrderStatus.VERIFIED,
    createdAt: new Date('2026-06-20T09:15:00.000Z'),
    completedAt: new Date('2026-06-20T14:30:00.000Z'),
    doctor: { firstName: 'Jane', lastName: 'Doe' },
    items: [
      {
        testVersion: { test: { name: 'Full Blood Count' } },
        results: [{ abnormalFlag: null, isCritical: false }],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated patient lab orders with pagination', async () => {
    prisma.labOrder.findMany = jest.fn().mockResolvedValue([listOrder]);
    prisma.labOrder.count = jest.fn().mockResolvedValue(1);

    const result = await service.listLabReports(patientUser, {
      page: 2,
      limit: 10,
    });

    expect(prisma.labOrder.findMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-uuid-1' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: expect.any(Object),
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'order-1',
          doctorName: 'Jane Doe',
          testNames: ['Full Blood Count'],
          summaryStatus: LabSummaryStatus.NORMAL,
        }),
      ],
      total: 1,
      page: 2,
      limit: 10,
      subjectPatientId: 'patient-uuid-1',
    });
  });

  it('returns lab report detail for the authenticated patient', async () => {
    prisma.labOrder.findFirst = jest.fn().mockResolvedValue({
      ...listOrder,
      verifiedAt: new Date('2026-06-20T15:00:00.000Z'),
      items: [
        {
          status: 'VERIFIED',
          testVersion: { test: { name: 'Full Blood Count' } },
          results: [
            {
              value: '11.2',
              abnormalFlag: LabAbnormalFlag.HIGH,
              isCritical: false,
              field: {
                label: 'White Blood Cell Count',
                unit: '×10⁹/L',
                referenceRange: '4.0–11.0',
                position: 0,
              },
            },
          ],
        },
      ],
    });

    const result = await service.getLabReport(patientUser, 'order-1');

    expect(prisma.labOrder.findFirst).toHaveBeenCalledWith({
      where: { id: 'order-1', patientId: 'patient-uuid-1' },
      include: expect.any(Object),
    });
    expect(result.id).toBe('order-1');
    expect(result.pdfUrl).toBeNull();
    expect(result.panels).toHaveLength(1);
    expect(result.panels[0].results[0].abnormalFlag).toBe(LabAbnormalFlag.HIGH);
  });

  it('throws NotFoundException when lab order belongs to another patient', async () => {
    prisma.labOrder.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.getLabReport(patientUser, 'other-order'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
