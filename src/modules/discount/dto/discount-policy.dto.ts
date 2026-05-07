import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DiscountReason, InvoiceCoverageMode } from '@prisma/client';

export class CreateDiscountPolicyDto {
  @ApiProperty({ example: 'Indigent Patient (50%)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountReason })
  @IsEnum(DiscountReason)
  reason!: DiscountReason;

  @ApiProperty({ enum: InvoiceCoverageMode, example: InvoiceCoverageMode.PERCENT })
  @IsEnum(InvoiceCoverageMode)
  mode!: InvoiceCoverageMode;

  @ApiProperty({
    description: 'Percent (0-100) when mode=PERCENT, or fixed amount when mode=FIXED',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  value!: number;

  @ApiPropertyOptional({
    description:
      'Optional owner staff UUID. When omitted, defaults to the authenticated staff.',
  })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateDiscountPolicyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: DiscountReason })
  @IsEnum(DiscountReason)
  @IsOptional()
  reason?: DiscountReason;

  @ApiPropertyOptional({ enum: InvoiceCoverageMode })
  @IsEnum(InvoiceCoverageMode)
  @IsOptional()
  mode?: InvoiceCoverageMode;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  @IsOptional()
  value?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class QueryDiscountPolicyDto {
  @ApiPropertyOptional({ enum: DiscountReason })
  @IsEnum(DiscountReason)
  @IsOptional()
  reason?: DiscountReason;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Search by name substring' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ example: 20 })
  @Type(() => Number)
  @IsOptional()
  take?: number = 20;
}

