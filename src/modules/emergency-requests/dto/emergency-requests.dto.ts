import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListStaffEmergencyRequestQueryDto {
  @ApiPropertyOptional({ enum: EmergencyRequestStatus })
  @IsOptional()
  @IsEnum(EmergencyRequestStatus)
  status?: EmergencyRequestStatus;

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

export class UpdateEmergencyRequestDto {
  @ApiProperty({ enum: EmergencyRequestStatus })
  @IsEnum(EmergencyRequestStatus)
  status!: EmergencyRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNote?: string;
}
