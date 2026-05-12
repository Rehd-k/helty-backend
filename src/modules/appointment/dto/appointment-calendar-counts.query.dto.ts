import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

/**
 * Query for GET /appointments/calendar-counts.
 * fromDate / toDate use the same ISO strings and {@link parseDateRange} window as GET /appointments.
 */
export class AppointmentCalendarCountsQueryDto {
  @ApiProperty({
    description:
      'Start of range (ISO 8601). Combined with toDate, normalized the same way as GET /appointments (parseDateRange → start-of-day of parsed date in the server process local timezone).',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description:
      'End of range (ISO 8601). Normalized to end-of-day like GET /appointments.',
    example: '2026-05-31T23:59:59.999Z',
  })
  @IsNotEmpty()
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({
    description:
      'When true, include appointments whose status is cancelled. Default false (cancelled excluded from counts).',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeCancelled?: boolean = false;
}
