import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { IVOrderStatus } from '@prisma/client';

export class CreateIvFluidOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fluidType: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  volume: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  rate: number;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty()
  @IsDateString()
  expectedEndTime: string;
}

export class UpdateIvFluidOrderDto {
  @ApiPropertyOptional({ enum: IVOrderStatus })
  @IsOptional()
  @IsEnum(IVOrderStatus)
  status?: IVOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedEndTime?: string;
}

export class CreateIvMonitoringDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  currentRate: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  insertionSiteCondition: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  stoppedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonStopped?: string;
}
