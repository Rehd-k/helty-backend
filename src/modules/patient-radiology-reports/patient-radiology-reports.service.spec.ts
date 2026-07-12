import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RadiologyModality as PrismaRadiologyModality,
  RadiologyRequestStatus,
  ReportSeverity,
} from '@prisma/client';

jest.mock('../../common/utils/human-readable-id.util', () => ({
  generateHumanReadableId: jest.fn(() => 'TESTID1234'),
  generateSafeNanoid: jest.fn(() => 'safe-nanoid'),
}));

import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { RadiologyImageService } from '../radiology/radiology-image.service';
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
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com'),
  } as unknown as ConfigService;

  const invoiceService = {
    assertInvoiceItemPaidOrInpatientCredit: jest.fn().mockResolvedValue(undefined),
  } as unknown as InvoiceService;

  const radiologyImageService = {
    getFile: jest.fn().mockResolvedValue({
      filePath: '/tmp/test.jpg',
      fileName: 'scan.jpg',
      mimeType: 'image/jpeg',
    }),
  } as unknown as RadiologyImageService;

  const service = new PatientRadiologyReportsService(
    prisma,
    config,
    invoiceService,
    radiologyImageService,
  );

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
    order: {
      patientId: 'patient-uuid-1',
      requestedBy: { firstName: 'Jane', lastName: 'Doe' },
    },
    procedure: {
      startTime: new Date('2024-11-12T10:30:00.000Z'),
      endTime: new Date('2024-11-12T11:00:00.000Z'),
    },
    report: {
      signedAt: new Date('2024-11-12T16:45:00.000Z'),
      findings: 'No acute abnormality.',
      impression: 'Unremarkable.',
      recommendations: 'Routine follow-up.',
      severity: ReportSeverity.NORMAL,
      signedBy: {
        firstName: 'Emem',
        lastName: 'Akpan',
      },
    },
    invoiceItem: { id: 'inv-item-1', service: { name: 'Brain MRI' } },
    images: [
      {
        id: 'img-1',
        fileName: 'scan.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        uploadedAt: new Date('2024-11-12T12:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    );
    invoiceService.assertInvoiceItemPaidOrInpatientCredit = jest
      .fn()
      .mockResolvedValue(undefined);
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

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'item-1',
          scanType: 'Brain MRI',
          status: RadiologyReportStatus.VERIFIED,
          referringDoctorName: 'Jane Doe',
          thumbnailUrl:
            'https://api.example.com/patient/radiology-reports/item-1/images/img-1/file',
        }),
      ],
      total: 2,
      page: 2,
      limit: 10,
      statistics: {
        totalScans: 2,
        pendingReviews: 1,
        profileCompleteness: 36,
      },
    });
  });

  it('returns radiology report detail for the authenticated patient when paid', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue(listItem);

    const result = await service.getRadiologyReport(patientUser, 'item-1');

    expect(result.id).toBe('item-1');
    expect(result.findings).toBe('No acute abnormality.');
    expect(result.impression).toBe('Unremarkable.');
    expect(result.recommendations).toBe('Routine follow-up.');
    expect(result.images).toHaveLength(1);
    expect(result.images?.[0].fileUrl).toContain('/images/img-1/file');
    expect(result.paymentRequired).toBe(false);
  });

  it('masks report content when invoice is unpaid', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue(listItem);
    invoiceService.assertInvoiceItemPaidOrInpatientCredit = jest
      .fn()
      .mockRejectedValue(new Error('unpaid'));

    const result = await service.getRadiologyReport(patientUser, 'item-1');

    expect(result.findings).toBeNull();
    expect(result.images).toEqual([]);
    expect(result.paymentRequired).toBe(true);
    expect(result.pdfUrl).toBeNull();
  });

  it('throws NotFoundException when radiology item belongs to another patient', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.getRadiologyReport(patientUser, 'other-item'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns image file when patient owns report and invoice is paid', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      invoiceItemId: 'inv-item-1',
      images: [{ id: 'img-1' }],
    });

    const result = await service.getRadiologyImageFile(
      patientUser,
      'item-1',
      'img-1',
    );

    expect(result.fileName).toBe('scan.jpg');
    expect(radiologyImageService.getFile).toHaveBeenCalledWith('img-1');
  });

  it('blocks image file access when invoice is unpaid', async () => {
    prisma.radiologyOrderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      invoiceItemId: 'inv-item-1',
      images: [{ id: 'img-1' }],
    });
    invoiceService.assertInvoiceItemPaidOrInpatientCredit = jest
      .fn()
      .mockRejectedValue(new Error('unpaid'));

    await expect(
      service.getRadiologyImageFile(patientUser, 'item-1', 'img-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
