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

export class ApplyHmoCoverageDto {
  @ApiProperty({ enum: InvoiceCoverageScope, example: InvoiceCoverageScope.INVOICE })
  @IsEnum(InvoiceCoverageScope)
  scope!: InvoiceCoverageScope;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required when scope=ITEM; invoice item ids to apply coverage to',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  itemIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional percent override (0-100). When omitted, uses HMO default/service override.',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  percentOverride?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

