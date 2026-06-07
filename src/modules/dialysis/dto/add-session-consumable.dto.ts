import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddSessionConsumableDto {
  @ApiProperty({ description: 'Consumable UUID' })
  @IsUUID()
  consumableId: string;

  @ApiProperty({ description: 'Store location for FIFO stock deduction' })
  @IsUUID()
  storeLocationId: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Selling price snapshot for billing',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'When true, add an invoice line and deduct billable stock',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
