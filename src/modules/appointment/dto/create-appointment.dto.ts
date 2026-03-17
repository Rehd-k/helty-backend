import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

export class CreateAppointmentDto {
  @IsString()
  patientId: string;

  @IsDateString()
  date: string;

  @IsEnum(AppointmentStatus)
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAppointmentDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
