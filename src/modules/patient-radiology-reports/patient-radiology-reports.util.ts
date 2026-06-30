import {
  RadiologyModality as PrismaRadiologyModality,
  RadiologyRequestStatus,
} from '@prisma/client';
import { formatDoctorName } from '../patient-medical-records/patient-medical-records.util';
import {
  RadiologyModality,
  RadiologyReportDetailDto,
  RadiologyReportStatus,
  RadiologyReportSummaryDto,
  RadiologyStatisticsDto,
} from './dto/radiology-report-response.dto';

type DoctorNameFields = {
  firstName: string | null;
  lastName: string | null;
};

type RadiologyItemRow = {
  id: string;
  scanType: PrismaRadiologyModality;
  bodyPart: string | null;
  contrast: boolean;
  status: RadiologyRequestStatus;
  createdAt: Date;
  order: {
    requestedBy: DoctorNameFields;
  };
  procedure: {
    startTime: Date;
    endTime: Date | null;
  } | null;
  report: {
    signedAt: Date;
    findings: string | null;
    impression: string | null;
    signedBy: DoctorNameFields;
  } | null;
  invoiceItem: {
    service: { name: string } | null;
  } | null;
};

type PatientProfileFields = {
  title?: string | null;
  firstName?: string | null;
  otherName?: string | null;
  surname?: string | null;
  dob?: Date | null;
  gender?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  addressOfResidence?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  hmoId?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
};

const MODALITY_LABELS: Record<PrismaRadiologyModality, string> = {
  [PrismaRadiologyModality.X_RAY]: 'X-Ray',
  [PrismaRadiologyModality.CT]: 'CT',
  [PrismaRadiologyModality.MRI]: 'MRI',
  [PrismaRadiologyModality.ULTRASOUND]: 'Ultrasound',
  [PrismaRadiologyModality.MAMMOGRAPHY]: 'Mammography',
  [PrismaRadiologyModality.FLUOROSCOPY]: 'Fluoroscopy',
  [PrismaRadiologyModality.OTHER]: 'Other',
};

const PROFILE_COMPLETENESS_FIELDS: (keyof PatientProfileFields)[] = [
  'title',
  'firstName',
  'otherName',
  'surname',
  'dob',
  'gender',
  'phoneNumber',
  'email',
  'addressOfResidence',
  'nextOfKinName',
  'nextOfKinPhone',
  'hmoId',
  'maritalStatus',
  'nationality',
];

export function mapModality(
  scanType: PrismaRadiologyModality,
): RadiologyModality {
  switch (scanType) {
    case PrismaRadiologyModality.X_RAY:
      return RadiologyModality.XRAY;
    case PrismaRadiologyModality.CT:
      return RadiologyModality.CT;
    case PrismaRadiologyModality.MRI:
      return RadiologyModality.MRI;
    case PrismaRadiologyModality.ULTRASOUND:
      return RadiologyModality.ULTRASOUND;
    default:
      return RadiologyModality.OTHER;
  }
}

export function mapReportStatus(
  status: RadiologyRequestStatus,
): RadiologyReportStatus {
  switch (status) {
    case RadiologyRequestStatus.PENDING:
    case RadiologyRequestStatus.SCHEDULED:
      return RadiologyReportStatus.PENDING;
    case RadiologyRequestStatus.IN_PROGRESS:
      return RadiologyReportStatus.IN_PROGRESS;
    case RadiologyRequestStatus.COMPLETED:
      return RadiologyReportStatus.FINALIZED;
    case RadiologyRequestStatus.REPORTED:
      return RadiologyReportStatus.VERIFIED;
    default:
      return RadiologyReportStatus.PENDING;
  }
}

export function isPendingReviewStatus(
  status: RadiologyRequestStatus,
): boolean {
  const mapped = mapReportStatus(status);
  return (
    mapped === RadiologyReportStatus.PENDING ||
    mapped === RadiologyReportStatus.IN_PROGRESS
  );
}

export function formatScanType(item: RadiologyItemRow): string {
  const serviceName = item.invoiceItem?.service?.name;
  if (serviceName) {
    return serviceName;
  }

  const modalityLabel = MODALITY_LABELS[item.scanType] ?? 'Scan';
  const parts: string[] = [];

  if (item.bodyPart) {
    parts.push(item.bodyPart);
  }
  parts.push(modalityLabel);

  let label = parts.join(' ');
  if (item.contrast) {
    label += ' (With Contrast)';
  }
  return label;
}

export function resolvePerformedAt(item: RadiologyItemRow): Date {
  return (
    item.procedure?.endTime ??
    item.procedure?.startTime ??
    item.report?.signedAt ??
    item.createdAt
  );
}

export function formatRadiologistName(radiologist: DoctorNameFields): string {
  return formatDoctorName(radiologist);
}

export function computeProfileCompleteness(
  patient: PatientProfileFields,
): number {
  const filled = PROFILE_COMPLETENESS_FIELDS.filter((field) => {
    const value = patient[field];
    return value != null && String(value).trim() !== '';
  }).length;
  return Math.round((filled / PROFILE_COMPLETENESS_FIELDS.length) * 100);
}

export function buildStatistics(
  totalScans: number,
  pendingReviews: number,
  profileCompleteness: number,
): RadiologyStatisticsDto {
  return {
    totalScans,
    pendingReviews,
    profileCompleteness,
  };
}

function buildPdfUrl(
  itemId: string,
  hasReport: boolean,
  apiBaseUrl: string,
): string | null {
  if (!hasReport || !apiBaseUrl) {
    return null;
  }
  return `${apiBaseUrl}/patient/radiology-reports/${itemId}/pdf`;
}

export function toRadiologyReportSummaryDto(
  item: RadiologyItemRow,
  apiBaseUrl = '',
): RadiologyReportSummaryDto {
  const radiologist = item.report?.signedBy;
  return {
    id: item.id,
    scanType: formatScanType(item),
    modality: mapModality(item.scanType),
    performedAt: resolvePerformedAt(item),
    radiologistName: radiologist
      ? formatRadiologistName(radiologist)
      : 'Pending assignment',
    referringDoctorName: formatDoctorName(item.order.requestedBy),
    status: mapReportStatus(item.status),
    pdfUrl: buildPdfUrl(item.id, Boolean(item.report), apiBaseUrl),
    dicomUrl: null,
    thumbnailUrl: null,
  };
}

export function toRadiologyReportDetailDto(
  item: RadiologyItemRow,
  apiBaseUrl = '',
): RadiologyReportDetailDto {
  const summary = toRadiologyReportSummaryDto(item, apiBaseUrl);
  return {
    ...summary,
    verifiedAt: item.report?.signedAt ?? null,
    findings: item.report?.findings ?? null,
    impression: item.report?.impression ?? null,
    reportBody: null,
  };
}
