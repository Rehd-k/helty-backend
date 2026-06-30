import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LabAbnormalFlag, LabOrderStatus } from '@prisma/client';

export enum LabSummaryStatus {
  PENDING = 'PENDING',
  NORMAL = 'NORMAL',
  ABNORMAL = 'ABNORMAL',
  CRITICAL = 'CRITICAL',
}

export class LabReportSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: LabOrderStatus })
  status!: LabOrderStatus;

  @ApiProperty()
  orderedAt!: Date;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiProperty()
  doctorName!: string;

  @ApiProperty({ type: [String] })
  testNames!: string[];

  @ApiProperty({ enum: LabSummaryStatus })
  summaryStatus!: LabSummaryStatus;
}

export class LabReportListResponseDto {
  @ApiProperty({ type: [LabReportSummaryDto] })
  data!: LabReportSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class LabResultLineDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  unit?: string | null;

  @ApiPropertyOptional()
  referenceRange?: string | null;

  @ApiPropertyOptional({ enum: LabAbnormalFlag })
  abnormalFlag?: LabAbnormalFlag | null;

  @ApiProperty()
  isCritical!: boolean;
}

export class LabResultPanelDto {
  @ApiProperty()
  testName!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [LabResultLineDto] })
  results!: LabResultLineDto[];
}

export class LabReportDetailDto extends LabReportSummaryDto {
  @ApiPropertyOptional()
  verifiedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  pdfUrl?: string | null;

  @ApiProperty({ type: [LabResultPanelDto] })
  panels!: LabResultPanelDto[];
}
