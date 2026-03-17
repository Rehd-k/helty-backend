import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostnatalVisitType } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListPostnatalVisitsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  labourDeliveryId?: string;

  @ApiPropertyOptional({ enum: PostnatalVisitType })
  @IsOptional()
  @IsEnum(PostnatalVisitType)
  type?: PostnatalVisitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 50;
}
