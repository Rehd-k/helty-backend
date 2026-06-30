import { LabAbnormalFlag, LabOrderStatus } from '@prisma/client';
import { formatDoctorName } from '../patient-medical-records/patient-medical-records.util';
import {
  LabReportDetailDto,
  LabReportSummaryDto,
  LabResultLineDto,
  LabResultPanelDto,
  LabSummaryStatus,
} from './dto/lab-report-response.dto';

type ResultFlags = {
  abnormalFlag: LabAbnormalFlag | null;
  isCritical: boolean;
};

type LabOrderListRow = {
  id: string;
  status: LabOrderStatus;
  createdAt: Date;
  completedAt: Date | null;
  doctor: { firstName: string | null; lastName: string | null };
  items: Array<{
    testVersion: { test: { name: string } };
    results: ResultFlags[];
  }>;
};

type LabOrderDetailRow = LabOrderListRow & {
  verifiedAt: Date | null;
  items: Array<{
    status: string;
    testVersion: { test: { name: string } };
    results: Array<
      ResultFlags & {
        value: string | null;
        field: {
          label: string;
          unit: string | null;
          referenceRange: string | null;
          position: number;
        };
      }
    >;
  }>;
};

const IN_PROGRESS_STATUSES: LabOrderStatus[] = [
  LabOrderStatus.PENDING,
  LabOrderStatus.SAMPLE_COLLECTED,
  LabOrderStatus.PROCESSING,
];

const COMPLETED_STATUSES: LabOrderStatus[] = [
  LabOrderStatus.COMPLETED,
  LabOrderStatus.VERIFIED,
];

export function deriveSummaryStatus(
  orderStatus: LabOrderStatus,
  results: ResultFlags[],
): LabSummaryStatus {
  if (IN_PROGRESS_STATUSES.includes(orderStatus)) {
    return LabSummaryStatus.PENDING;
  }

  if (results.some((r) => r.isCritical)) {
    return LabSummaryStatus.CRITICAL;
  }

  if (results.some((r) => r.abnormalFlag != null)) {
    return LabSummaryStatus.ABNORMAL;
  }

  if (COMPLETED_STATUSES.includes(orderStatus)) {
    if (results.length === 0) {
      return LabSummaryStatus.PENDING;
    }
    return LabSummaryStatus.NORMAL;
  }

  return LabSummaryStatus.PENDING;
}

function collectTestNames(
  items: LabOrderListRow['items'],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const name = item.testVersion.test.name;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

function flattenResults(items: LabOrderListRow['items']): ResultFlags[] {
  return items.flatMap((item) => item.results);
}

function toResultLineDto(
  result: LabOrderDetailRow['items'][number]['results'][number],
): LabResultLineDto {
  return {
    label: result.field.label,
    value: result.value ?? '',
    unit: result.field.unit,
    referenceRange: result.field.referenceRange,
    abnormalFlag: result.abnormalFlag,
    isCritical: result.isCritical,
  };
}

function toPanelDto(
  item: LabOrderDetailRow['items'][number],
): LabResultPanelDto {
  return {
    testName: item.testVersion.test.name,
    status: item.status,
    results: item.results.map(toResultLineDto),
  };
}

export function toLabReportSummaryDto(
  order: LabOrderListRow,
): LabReportSummaryDto {
  const allResults = flattenResults(order.items);
  return {
    id: order.id,
    status: order.status,
    orderedAt: order.createdAt,
    completedAt: order.completedAt,
    doctorName: formatDoctorName(order.doctor),
    testNames: collectTestNames(order.items),
    summaryStatus: deriveSummaryStatus(order.status, allResults),
  };
}

export function toLabReportDetailDto(
  order: LabOrderDetailRow,
): LabReportDetailDto {
  const summary = toLabReportSummaryDto(order);
  return {
    ...summary,
    verifiedAt: order.verifiedAt,
    pdfUrl: null,
    panels: order.items.map(toPanelDto),
  };
}
