import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionRefillRequestStatus } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class ListPharmacyRefillRequestsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ enum: PrescriptionRefillRequestStatus })
  @IsEnum(PrescriptionRefillRequestStatus)
  @IsOptional()
  status?: PrescriptionRefillRequestStatus;

  @ApiPropertyOptional({
    description: 'Hospital patient ID (e.g. WB2YEP9K), not patient UUID',
  })
  @IsString()
  @IsOptional()
  patientId?: string;
}

export class UpdatePharmacyRefillRequestDto {
  @ApiProperty({ enum: PrescriptionRefillRequestStatus })
  @IsEnum(PrescriptionRefillRequestStatus)
  @IsNotEmpty()
  status: PrescriptionRefillRequestStatus;

  @ApiProperty({ description: 'Staff UUID performing the review' })
  @IsUUID()
  @IsNotEmpty()
  reviewedByStaffId: string;

  @ApiPropertyOptional({ description: 'Pharmacy notes (required when rejecting)' })
  @IsString()
  @IsOptional()
  pharmacyNotes?: string;
}

export class BillPharmacyRefillRequestDto {
  @ApiProperty({ description: 'Staff UUID of the billing pharmacist' })
  @IsUUID()
  @IsNotEmpty()
  billedByStaffId: string;

  @ApiProperty({ description: 'Encounter UUID — scopes the invoice' })
  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @ApiProperty({ description: 'Units to bill and dispense', example: 14 })
  @IsInt()
  @IsPositive()
  quantity: number;
}
