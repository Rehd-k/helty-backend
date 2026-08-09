import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConfirmAppointmentRequestDto {
  @ApiProperty({ description: 'Physician staff UUID to assign' })
  @IsUUID()
  staffId!: string;

  @ApiPropertyOptional({
    description: 'Optional confirmed date/time (ISO). Keeps request date when omitted.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class DenyAppointmentRequestDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListAppointmentRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status (defaults to REQUESTED)',
    example: 'REQUESTED',
  })
  @IsOptional()
  @IsString()
  status?: string = 'REQUESTED';
}
