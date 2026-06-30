import {
  RadiologyModality as PrismaRadiologyModality,
  RadiologyRequestStatus,
} from '@prisma/client';
import {
  RadiologyModality,
  RadiologyReportStatus,
} from './dto/radiology-report-response.dto';
import {
  computeProfileCompleteness,
  formatScanType,
  isPendingReviewStatus,
  mapModality,
  mapReportStatus,
  resolvePerformedAt,
  toRadiologyReportDetailDto,
  toRadiologyReportSummaryDto,
} from './patient-radiology-reports.util';

describe('patient-radiology-reports.util', () => {
  describe('mapModality', () => {
    it('maps Prisma modalities to API enum', () => {
      expect(mapModality(PrismaRadiologyModality.X_RAY)).toBe(
        RadiologyModality.XRAY,
      );
      expect(mapModality(PrismaRadiologyModality.MRI)).toBe(
        RadiologyModality.MRI,
      );
      expect(mapModality(PrismaRadiologyModality.MAMMOGRAPHY)).toBe(
        RadiologyModality.OTHER,
      );
    });
  });

  describe('mapReportStatus', () => {
    it('maps Prisma statuses to patient-facing enum', () => {
      expect(mapReportStatus(RadiologyRequestStatus.PENDING)).toBe(
        RadiologyReportStatus.PENDING,
      );
      expect(mapReportStatus(RadiologyRequestStatus.SCHEDULED)).toBe(
        RadiologyReportStatus.PENDING,
      );
      expect(mapReportStatus(RadiologyRequestStatus.IN_PROGRESS)).toBe(
        RadiologyReportStatus.IN_PROGRESS,
      );
      expect(mapReportStatus(RadiologyRequestStatus.COMPLETED)).toBe(
        RadiologyReportStatus.FINALIZED,
      );
      expect(mapReportStatus(RadiologyRequestStatus.REPORTED)).toBe(
        RadiologyReportStatus.VERIFIED,
      );
    });
  });

  describe('isPendingReviewStatus', () => {
    it('returns true for pending and in-progress statuses', () => {
      expect(isPendingReviewStatus(RadiologyRequestStatus.PENDING)).toBe(true);
      expect(isPendingReviewStatus(RadiologyRequestStatus.SCHEDULED)).toBe(
        true,
      );
      expect(isPendingReviewStatus(RadiologyRequestStatus.IN_PROGRESS)).toBe(
        true,
      );
      expect(isPendingReviewStatus(RadiologyRequestStatus.REPORTED)).toBe(
        false,
      );
    });
  });

  describe('formatScanType', () => {
    const baseItem = {
      id: 'item-1',
      scanType: PrismaRadiologyModality.MRI,
      bodyPart: 'Brain',
      contrast: true,
      status: RadiologyRequestStatus.REPORTED,
      createdAt: new Date('2024-11-12T10:30:00.000Z'),
      order: { requestedBy: { firstName: 'Jane', lastName: 'Doe' } },
      procedure: null,
      report: null,
      invoiceItem: null,
    };

    it('prefers invoice service name', () => {
      expect(
        formatScanType({
          ...baseItem,
          invoiceItem: { service: { name: 'Brain MRI (With Contrast)' } },
        }),
      ).toBe('Brain MRI (With Contrast)');
    });

    it('formats from body part, modality, and contrast', () => {
      expect(formatScanType(baseItem)).toBe('Brain MRI (With Contrast)');
    });

    it('formats modality-only when no body part', () => {
      expect(
        formatScanType({
          ...baseItem,
          bodyPart: null,
          contrast: false,
          scanType: PrismaRadiologyModality.X_RAY,
        }),
      ).toBe('X-Ray');
    });
  });

  describe('resolvePerformedAt', () => {
    const baseItem = {
      id: 'item-1',
      scanType: PrismaRadiologyModality.MRI,
      bodyPart: null,
      contrast: false,
      status: RadiologyRequestStatus.REPORTED,
      createdAt: new Date('2024-11-12T10:30:00.000Z'),
      order: { requestedBy: { firstName: 'Jane', lastName: 'Doe' } },
      procedure: null,
      report: null,
      invoiceItem: null,
    };

    it('prefers procedure end time', () => {
      const endTime = new Date('2024-11-12T11:00:00.000Z');
      expect(
        resolvePerformedAt({
          ...baseItem,
          procedure: {
            startTime: new Date('2024-11-12T10:45:00.000Z'),
            endTime,
          },
        }),
      ).toEqual(endTime);
    });

    it('falls back to createdAt', () => {
      expect(resolvePerformedAt(baseItem)).toEqual(baseItem.createdAt);
    });
  });

  describe('computeProfileCompleteness', () => {
    it('returns percentage of filled profile fields', () => {
      const score = computeProfileCompleteness({
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
      expect(score).toBe(36);
    });

    it('returns 100 when all fields are filled', () => {
      expect(
        computeProfileCompleteness({
          title: 'Mr',
          firstName: 'John',
          otherName: 'Michael',
          surname: 'Doe',
          dob: new Date('1990-01-01'),
          gender: 'Male',
          phoneNumber: '08012345678',
          email: 'john@example.com',
          addressOfResidence: 'Lagos',
          nextOfKinName: 'Jane Doe',
          nextOfKinPhone: '08087654321',
          hmoId: 'hmo-1',
          maritalStatus: 'Single',
          nationality: 'Nigerian',
        }),
      ).toBe(100);
    });
  });

  describe('toRadiologyReportSummaryDto', () => {
    const item = {
      id: '660e8400-e29b-41d4-a716-446655440001',
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

    it('maps list fields', () => {
      const dto = toRadiologyReportSummaryDto(
        item,
        'https://api.example.com',
      );

      expect(dto).toEqual({
        id: item.id,
        scanType: 'Brain MRI (With Contrast)',
        modality: RadiologyModality.MRI,
        performedAt: item.procedure!.endTime,
        radiologistName: 'Emem Akpan',
        referringDoctorName: 'Jane Doe',
        status: RadiologyReportStatus.VERIFIED,
        pdfUrl:
          'https://api.example.com/patient/radiology-reports/660e8400-e29b-41d4-a716-446655440001/pdf',
        dicomUrl: null,
        thumbnailUrl: null,
      });
    });
  });

  describe('toRadiologyReportDetailDto', () => {
    it('includes findings, impression, and verifiedAt', () => {
      const item = {
        id: 'item-1',
        scanType: PrismaRadiologyModality.X_RAY,
        bodyPart: 'Chest',
        contrast: false,
        status: RadiologyRequestStatus.REPORTED,
        createdAt: new Date('2024-10-24T14:00:00.000Z'),
        order: { requestedBy: { firstName: 'Olayinka', lastName: 'G.' } },
        procedure: null,
        report: {
          signedAt: new Date('2024-10-24T16:00:00.000Z'),
          findings: 'Clear lung fields.',
          impression: 'Normal chest X-ray.',
          signedBy: { firstName: 'Olayinka', lastName: 'G.' },
        },
        invoiceItem: null,
      };

      const dto = toRadiologyReportDetailDto(item);

      expect(dto.verifiedAt).toEqual(item.report.signedAt);
      expect(dto.findings).toBe('Clear lung fields.');
      expect(dto.impression).toBe('Normal chest X-ray.');
      expect(dto.reportBody).toBeNull();
      expect(dto.pdfUrl).toBeNull();
    });
  });
});
