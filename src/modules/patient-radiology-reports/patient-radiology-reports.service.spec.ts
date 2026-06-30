import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RadiologyModality as PrismaRadiologyModality,
  RadiologyRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { RadiologyReportStatus } from './dto/radiology-report-response.dto';
import { PatientRadiologyReportsService } from './patient-radiology-reports.service';

describe('PatientRadiologyReportsService', () => {
  const prisma = {
    radiologyOrderItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    patient: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com'),
  } as unknown as ConfigService;

  const service = new PatientRadiologyReportsService(prisma, config);

  const patientUser: PatientJwtPayload = {
    sub: 'patient-uuid-1',
    patientId: 'AB12CD34',
    accountType: 'PATIENT',
  };

  const listItem = {
    id: 'item-1',
    scanType: PrismaRadiologyModality.MRI,
    bodyPart: 'Brain',
    contrast: true,
    status: RadiologyRequestStatus.REPORTED,
    createdAt: new Date('2024-11-12T10:30:00.000Z'),
    order: { requestedBy: { firstName: 'Jane', lastName: 'Doe' } },
    procedure: {
      startTime: new Date('2024-11-12T10:30:00.000Z'),
      endTime: new Date('2024-11-12T11:00:00.000Z'),
    },
    report: {
      signedAt: new Date('2024-11-12T16:45:00.000Z'),
      findings: 'No acute abnormality.',
      impression: 'Unremarkable.',
      signedBy: {
        firstName: 'Emem',
        lastName: 'Akpan',
      },
    },
    invoiceItem: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated patient radiology items with pagination and statistics', async () => {
    prisma.radiologyOrderItem.findMany = jest
      .fn()
      .mockResolvedValueOnce([listItem])
      .mockResolvedValueOnce([
        { status: RadiologyRequestStatus.REPORTED },
        { status: RadiologyRequestStatus.PENDING },
      ]);
    prisma.radiologyOrderItem.count = jest.fn().mockResolvedValue(2);
    prisma.patient.findUnique = jest.fn().mockResolvedValue({
      firstName: 'John',
      surname: 'Doe',
      dob: new Date('1990-01-01'),
      gender: 'Male',
      phoneNumber: '08012345678',
      email: null,
      addressOfResidence: null,
      nextOfKinName: null,
      nextOfKinPhone: null,
      hmoId: null,
      maritalStatus: null,
      nationality: null,
    });

    const result = await service.listRadiologyReports(patientUser, {
      page: 2,
      limit: 10,
    });

    expect(prisma.radiologyOrderItem.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: { not: RadiologyRequestStatus.CANCELLED },
        order: { patientId: 'patient-uuid-1' },
      },
      skip: 10,
      take: 10,
      orderBy: [
        { report: { signedAt: 'desc' } },
        { procedure: { endTime: 'desc' } },
        { createdAt: 'desc' },
      ],
      include: expect.any(Object),
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'item-1',
          scanType: 'Brain MRI (With Contrast)',
          status: RadiologyReportStatus.VERIFIED,
          referringDoctorName: 'Jane Doe',
        }),
      ],
      total: 2,
      page: 2,
      limit: 10,
      statistics: {
        totalScans: 2,
        pendingReviews: 1,
        profileCompleteness: 42,
      },
    });
  });

  it('returns radiology report detail for the authenticated patient', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue(listItem);

    const result = await service.getRadiologyReport(patientUser, 'item-1');

    expect(prisma.radiologyOrderItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'item-1',
        status: { not: RadiologyRequestStatus.CANCELLED },
        order: { patientId: 'patient-uuid-1' },
      },
      include: expect.any(Object),
    });
    expect(result.id).toBe('item-1');
    expect(result.findings).toBe('No acute abnormality.');
    expect(result.impression).toBe('Unremarkable.');
    expect(result.pdfUrl).toContain('/patient/radiology-reports/item-1/pdf');
  });

  it('throws NotFoundException when radiology item belongs to another patient', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.getRadiologyReport(patientUser, 'other-item'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
