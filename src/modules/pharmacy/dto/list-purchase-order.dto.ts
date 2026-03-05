import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';
import { PaginationDto } from './pagination.dto';

export class ListPurchaseOrderDto extends PaginationDto {
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
