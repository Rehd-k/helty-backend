import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyRequestStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

export class CreateEmergencyRequestDto {
  @ApiProperty({ description: 'GPS latitude' })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? value
      : Number(value),
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'GPS longitude' })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? value
      : Number(value),
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in meters' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @ApiPropertyOptional({ description: 'Text description of the emergency' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class ListEmergencyRequestQueryDto {
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
