import { LabAbnormalFlag, LabOrderStatus } from '@prisma/client';
import {
  deriveSummaryStatus,
  toLabReportDetailDto,
  toLabReportSummaryDto,
} from './patient-lab-reports.util';
import { LabSummaryStatus } from './dto/lab-report-response.dto';

describe('patient-lab-reports.util', () => {
  describe('deriveSummaryStatus', () => {
    it('returns PENDING for in-progress order statuses', () => {
      for (const status of [
        LabOrderStatus.PENDING,
        LabOrderStatus.SAMPLE_COLLECTED,
        LabOrderStatus.PROCESSING,
      ]) {
        expect(
          deriveSummaryStatus(status, [
            { abnormalFlag: LabAbnormalFlag.HIGH, isCritical: true },
          ]),
        ).toBe(LabSummaryStatus.PENDING);
      }
    });

    it('returns CRITICAL when any result is critical', () => {
      expect(
        deriveSummaryStatus(LabOrderStatus.VERIFIED, [
          { abnormalFlag: LabAbnormalFlag.HIGH, isCritical: true },
        ]),
      ).toBe(LabSummaryStatus.CRITICAL);
    });

    it('returns ABNORMAL when any result has abnormal flag but none critical', () => {
      expect(
        deriveSummaryStatus(LabOrderStatus.VERIFIED, [
          { abnormalFlag: LabAbnormalFlag.HIGH, isCritical: false },
        ]),
      ).toBe(LabSummaryStatus.ABNORMAL);
    });

    it('returns NORMAL when completed with all normal results', () => {
      expect(
        deriveSummaryStatus(LabOrderStatus.COMPLETED, [
          { abnormalFlag: null, isCritical: false },
          { abnormalFlag: null, isCritical: false },
        ]),
      ).toBe(LabSummaryStatus.NORMAL);
    });

    it('returns PENDING when completed with no results', () => {
      expect(
        deriveSummaryStatus(LabOrderStatus.COMPLETED, []),
      ).toBe(LabSummaryStatus.PENDING);
    });
  });

  describe('toLabReportSummaryDto', () => {
    const baseOrder = {
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
        {
          testVersion: { test: { name: 'Lipid Panel' } },
          results: [{ abnormalFlag: LabAbnormalFlag.HIGH, isCritical: false }],
        },
      ],
    };

    it('maps list fields and derives summary status', () => {
      const dto = toLabReportSummaryDto(baseOrder);

      expect(dto).toEqual({
        id: 'order-1',
        status: LabOrderStatus.VERIFIED,
        orderedAt: baseOrder.createdAt,
        completedAt: baseOrder.completedAt,
        doctorName: 'Jane Doe',
        testNames: ['Full Blood Count', 'Lipid Panel'],
        summaryStatus: LabSummaryStatus.ABNORMAL,
      });
    });
  });

  describe('toLabReportDetailDto', () => {
    it('maps panels and sets pdfUrl to null', () => {
      const order = {
        id: 'order-1',
        status: LabOrderStatus.VERIFIED,
        createdAt: new Date('2026-06-20T09:15:00.000Z'),
        completedAt: new Date('2026-06-20T14:30:00.000Z'),
        verifiedAt: new Date('2026-06-20T15:00:00.000Z'),
        doctor: { firstName: 'Jane', lastName: 'Doe' },
        items: [
          {
            status: 'COMPLETED',
            testVersion: { test: { name: 'Full Blood Count' } },
            results: [
              {
                value: '12.4',
                abnormalFlag: null,
                isCritical: false,
                field: {
                  label: 'Haemoglobin',
                  unit: 'g/dL',
                  referenceRange: '12.0–16.0',
                  position: 0,
                },
              },
            ],
          },
        ],
      };

      const dto = toLabReportDetailDto(order);

      expect(dto.verifiedAt).toEqual(order.verifiedAt);
      expect(dto.pdfUrl).toBeNull();
      expect(dto.panels).toEqual([
        {
          testName: 'Full Blood Count',
          status: 'COMPLETED',
          results: [
            {
              label: 'Haemoglobin',
              value: '12.4',
              unit: 'g/dL',
              referenceRange: '12.0–16.0',
              abnormalFlag: null,
              isCritical: false,
            },
          ],
        },
      ]);
    });
  });
});
