import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentVisitType } from '@prisma/client';

export class AppointmentDoctorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  specialty!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

export class AppointmentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: ['REQUESTED', 'CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED'],
  })
  status!: 'REQUESTED' | 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';

  @ApiProperty()
  scheduledAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  location!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'MedicalSpecialty enum value when requested without a doctor',
  })
  specialty!: string | null;

  @ApiProperty({ enum: AppointmentVisitType })
  visitType!: AppointmentVisitType;

  @ApiProperty({ type: AppointmentDoctorDto })
  doctor!: AppointmentDoctorDto;

  @ApiProperty()
  canReschedule!: boolean;

  @ApiProperty()
  canCancel!: boolean;
}

export class AppointmentDetailDto extends AppointmentSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ConsultationHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  providerName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  department!: string | null;

  @ApiProperty()
  visitedAt!: Date;

  @ApiProperty({
    enum: ['NORMAL', 'COMPLETED', 'ABNORMAL', 'PENDING'],
  })
  resultStatus!: 'NORMAL' | 'COMPLETED' | 'ABNORMAL' | 'PENDING';
}

export class AppointmentsDashboardResponseDto {
  @ApiPropertyOptional({ type: AppointmentSummaryDto, nullable: true })
  nextAppointment!: AppointmentSummaryDto | null;

  @ApiProperty({ type: [AppointmentSummaryDto] })
  upcomingAppointments!: AppointmentSummaryDto[];

  @ApiProperty({ type: [ConsultationHistoryItemDto] })
  consultationHistory!: ConsultationHistoryItemDto[];
}

export class AppointmentListResponseDto {
  @ApiProperty({ type: [AppointmentSummaryDto] })
  data!: AppointmentSummaryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class SpecialtyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;
}

export class SpecialtyListResponseDto {
  @ApiProperty({ type: [SpecialtyDto] })
  data!: SpecialtyDto[];
}

export class BookingDoctorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  specialty!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;
}

export class BookingDoctorListResponseDto {
  @ApiProperty({ type: [BookingDoctorDto] })
  data!: BookingDoctorDto[];
}

export class AvailabilitySlotDto {
  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty()
  available!: boolean;
}

export class AvailabilityResponseDto {
  @ApiProperty()
  doctorId!: string;

  @ApiProperty({ example: '2024-10-24' })
  date!: string;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  slots!: AvailabilitySlotDto[];
}

export class CancelAppointmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['CANCELLED'] })
  status!: 'CANCELLED';
}
