import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RadiologyReportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINALIZED = 'FINALIZED',
  VERIFIED = 'VERIFIED',
}

export enum RadiologyModality {
  MRI = 'MRI',
  XRAY = 'XRAY',
  CT = 'CT',
  ULTRASOUND = 'ULTRASOUND',
  ECHO = 'ECHO',
  OTHER = 'OTHER',
}

export enum RadiologyReportSeverity {
  NORMAL = 'NORMAL',
  ABNORMAL = 'ABNORMAL',
  CRITICAL = 'CRITICAL',
}

export class RadiologyReportImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fileName!: string;

  @ApiPropertyOptional({ nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileSize?: number | null;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty()
  fileUrl!: string;
}

export class RadiologyReportSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  scanType!: string;

  @ApiProperty({ enum: RadiologyModality })
  modality!: RadiologyModality;

  @ApiProperty()
  performedAt!: Date;

  @ApiProperty()
  radiologistName!: string;

  @ApiProperty()
  referringDoctorName!: string;

  @ApiProperty({ enum: RadiologyReportStatus })
  status!: RadiologyReportStatus;

  @ApiPropertyOptional({ nullable: true })
  pdfUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  dicomUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl?: string | null;
}

export class RadiologyStatisticsDto {
  @ApiProperty()
  totalScans!: number;

  @ApiProperty()
  pendingReviews!: number;

  @ApiProperty()
  profileCompleteness!: number;
}

export class RadiologyReportListResponseDto {
  @ApiProperty({ type: [RadiologyReportSummaryDto] })
  data!: RadiologyReportSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty({ type: RadiologyStatisticsDto })
  statistics!: RadiologyStatisticsDto;
}

export class RadiologyReportDetailDto extends RadiologyReportSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  verifiedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  findings?: string | null;

  @ApiPropertyOptional({ nullable: true })
  impression?: string | null;

  @ApiPropertyOptional({ nullable: true })
  recommendations?: string | null;

  @ApiPropertyOptional({ enum: RadiologyReportSeverity, nullable: true })
  severity?: RadiologyReportSeverity | null;

  @ApiPropertyOptional({ nullable: true })
  reportBody?: string | null;

  @ApiPropertyOptional({ type: [RadiologyReportImageDto] })
  images?: RadiologyReportImageDto[];

  @ApiPropertyOptional({
    description: 'True when the linked invoice is unpaid and results are withheld',
  })
  paymentRequired?: boolean;
}
