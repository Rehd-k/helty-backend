import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { InvoiceCoverageScope } from '@prisma/client';

export class ApplyDiscountDto {
  @ApiProperty({ description: 'DiscountPolicy UUID' })
  @IsUUID()
  policyId!: string;

  @ApiProperty({ enum: InvoiceCoverageScope, example: InvoiceCoverageScope.INVOICE })
  @IsEnum(InvoiceCoverageScope)
  scope!: InvoiceCoverageScope;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required when scope=ITEM; invoice item ids to apply discount to',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  itemIds?: string[];

  @ApiPropertyOptional({
    description:
      'Optional override for policy value (percent 0-100 when mode=PERCENT; fixed amount when mode=FIXED).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  @IsOptional()
  valueOverride?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

