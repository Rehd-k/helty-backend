import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsumableUsageSource } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordConsumableUsageDto {
  @ApiProperty()
  @IsUUID()
  consumableId: string;

  @ApiProperty({ description: 'Store location for FIFO deduction' })
  @IsUUID()
  storeLocationId: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiProperty({ enum: ConsumableUsageSource })
  @IsEnum(ConsumableUsageSource)
  source: ConsumableUsageSource;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class ListConsumableHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  consumableId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
