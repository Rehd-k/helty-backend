import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateWaitingPatientDto {
  @ApiProperty({
    description:
      'Deprecated: waiting-patient records are no longer created directly.',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;
}

export class SendToConsultingRoomDto {
  @ApiProperty({
    description:
      'Consulting room UUID to assign to this paid consultation invoice',
  })
  @IsUUID()
  @IsNotEmpty()
  consultingRoomId: string;

  @ApiPropertyOptional({
    description: 'Staff UUID of the user assigning the consulting room',
  })
  @IsUUID()
  @IsOptional()
  staffId?: string;
}

export class UpdateWaitingPatientDto {
  @ApiPropertyOptional({
    description: 'Consulting room UUID to move this invoice-backed queue entry',
  })
  @IsUUID()
  @IsOptional()
  consultingRoomId?: string;

  @ApiPropertyOptional({
    description:
      'Whether patient has been seen. Derived from encounter linkage; not set directly here.',
  })
  @IsBoolean()
  @IsOptional()
  seen?: boolean;

  @ApiPropertyOptional({
    description: 'Staff UUID of the user updating this queue entry',
  })
  @IsUUID()
  @IsOptional()
  staffId?: string;
}

export class QueryWaitingPatientDto {
  @ApiPropertyOptional({ description: 'Filter by consulting room UUID' })
  @IsUUID()
  @IsOptional()
  consultingRoomId?: string;

  @ApiPropertyOptional({
    description: 'If true, return only entries not yet assigned to a room',
  })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  unassignedOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'If true, return only entries not yet registered to the system',
  })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  unregisteredOnly?: boolean;

  @ApiPropertyOptional({
    description: 'If true, return only entries already linked to an encounter',
  })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  seen?: boolean;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({
    description:
      'Search by patient name, hospital patient ID, invoice ID, or consultation service name',
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 0;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description:
      'Page size (max 20). Each request returns at most 20 queue rows.',
    example: 20,
    maximum: 20,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 20;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 20;
    return Math.min(20, Math.floor(n));
  })
  @IsInt()
  @IsPositive()
  @Max(20)
  @IsOptional()
  take?: number = 20;

  @ApiPropertyOptional({
    description:
      'Optional start date (ISO 8601). If omitted together with toDate, no date filter is applied.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'Optional end date (ISO 8601). If omitted together with fromDate, no date filter is applied.',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
