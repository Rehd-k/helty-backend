import { ApiPropertyOptional } from '@nestjs/swagger';
import { PatientDeviceStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPatientDevicesQueryDto {
  @ApiPropertyOptional({ enum: PatientDeviceStatus })
  @IsOptional()
  @IsEnum(PatientDeviceStatus)
  status?: PatientDeviceStatus;

  @ApiPropertyOptional({ description: 'Search by patient hospital ID or name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
