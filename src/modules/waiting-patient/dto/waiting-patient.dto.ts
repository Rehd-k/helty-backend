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
    description: 'Consulting room UUID to assign to this paid consultation invoice',
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

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
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

