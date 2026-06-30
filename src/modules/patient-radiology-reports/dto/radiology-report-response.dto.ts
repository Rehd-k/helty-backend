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
  reportBody?: string | null;
}
