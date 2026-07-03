import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiPropertyOptional()
  @ValidateIf((dto: RescheduleAppointmentDto) => !dto.reason)
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((dto: RescheduleAppointmentDto) => !dto.scheduledAt)
  @IsOptional()
  @IsString()
  reason?: string;
}
