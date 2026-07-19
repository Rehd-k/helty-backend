import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { AppointmentListFilter } from '../patient-appointments.constants';
import {
  APPOINTMENT_LIST_FILTER,
} from '../patient-appointments.constants';

export class AppointmentsDashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'View appointments for a linked child (defaults to the logged-in patient)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  forPatientId?: string;

  @ApiPropertyOptional({
    enum: Object.values(APPOINTMENT_LIST_FILTER),
    default: APPOINTMENT_LIST_FILTER.UPCOMING,
  })
  @IsOptional()
  @IsEnum(APPOINTMENT_LIST_FILTER)
  status?: AppointmentListFilter = APPOINTMENT_LIST_FILTER.UPCOMING;
}

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({
    description:
      'View appointments for a linked child (defaults to the logged-in patient)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  forPatientId?: string;

  @ApiPropertyOptional({
    enum: Object.values(APPOINTMENT_LIST_FILTER),
    default: APPOINTMENT_LIST_FILTER.UPCOMING,
  })
  @IsOptional()
  @IsEnum(APPOINTMENT_LIST_FILTER)
  status?: AppointmentListFilter = APPOINTMENT_LIST_FILTER.UPCOMING;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
