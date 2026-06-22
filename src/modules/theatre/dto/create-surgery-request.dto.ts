import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SurgeryPriority, SurgeryRequestStatus } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class CreateSurgeryRequestDto {
  @ApiProperty({ description: 'Encounter UUID' })
  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @ApiProperty({ description: 'Patient UUID (must match encounter patient)' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Staff UUID of the requesting doctor' })
  @IsUUID()
  @IsNotEmpty()
  requestedById: string;

  @ApiProperty({ description: 'Surgical procedure service UUID' })
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiPropertyOptional({ description: 'Active admission UUID for inpatients' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiPropertyOptional({ enum: SurgeryPriority, default: SurgeryPriority.ROUTINE })
  @IsEnum(SurgeryPriority)
  @IsOptional()
  priority?: SurgeryPriority;

  @ApiPropertyOptional({ description: 'Clinical indication / notes' })
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional({ description: 'Doctor preferred surgery date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  preferredDate?: string;
}

export class ListSurgeryRequestsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ description: 'Filter by encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ enum: SurgeryRequestStatus })
  @IsEnum(SurgeryRequestStatus)
  @IsOptional()
  status?: SurgeryRequestStatus;
}

export class UpdateSurgeryRequestDto {
  @ApiPropertyOptional({ enum: SurgeryRequestStatus })
  @IsEnum(SurgeryRequestStatus)
  @IsOptional()
  status?: SurgeryRequestStatus;

  @ApiPropertyOptional({ enum: SurgeryPriority })
  @IsEnum(SurgeryPriority)
  @IsOptional()
  priority?: SurgeryPriority;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  preferredDate?: string;
}
