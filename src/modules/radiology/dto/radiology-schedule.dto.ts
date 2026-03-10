import { IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRadiologyScheduleDto {
  @ApiProperty({ description: 'Scheduled date and time (ISO 8601)' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Staff UUID of assigned radiographer' })
  @IsUUID()
  @IsOptional()
  radiographerId?: string;

  @ApiPropertyOptional({ description: 'Radiology machine UUID' })
  @IsUUID()
  @IsOptional()
  machineId?: string;
}

export class UpdateRadiologyScheduleDto {
  @ApiPropertyOptional({ description: 'Scheduled date and time (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Staff UUID of assigned radiographer' })
  @IsUUID()
  @IsOptional()
  radiographerId?: string;

  @ApiPropertyOptional({ description: 'Radiology machine UUID' })
  @IsUUID()
  @IsOptional()
  machineId?: string;
}
