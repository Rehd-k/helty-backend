import { IsUUID, IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRadiologyProcedureDto {
  @ApiProperty({ description: 'Staff UUID of radiographer performing the scan' })
  @IsUUID()
  performedById: string;

  @ApiPropertyOptional({ description: 'Radiology machine UUID' })
  @IsUUID()
  @IsOptional()
  machineId?: string;

  @ApiProperty({ description: 'Scan start time (ISO 8601)' })
  @IsDateString()
  startTime: string;

  @ApiPropertyOptional({ description: 'Scan completion time (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Notes during procedure' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRadiologyProcedureDto {
  @ApiPropertyOptional({ description: 'Scan completion time (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Notes during procedure' })
  @IsString()
  @IsOptional()
  notes?: string;
}
