import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class ListPurchaseOrderDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Start date (ISO 8601). Will be normalized to start-of-day. Defaults to today if omitted/empty/invalid.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO 8601). Will be normalized to end-of-day. Defaults to today if omitted/empty/invalid.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'totalAmount', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'totalAmount', 'status'])
  sortBy?: 'createdAt' | 'totalAmount' | 'status' = undefined;
}
