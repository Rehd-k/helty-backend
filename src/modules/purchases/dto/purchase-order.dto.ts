import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchasesOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreatePurchasesPurchaseOrderLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumberString()
  unitCost: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalItemName?: string;
}

export class CreatePurchasesPurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty({ type: [CreatePurchasesPurchaseOrderLineDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchasesPurchaseOrderLineDto)
  @ArrayMinSize(1)
  lines: CreatePurchasesPurchaseOrderLineDto[];
}

export class UpdatePurchasesPurchaseOrderStatusDto {
  @ApiProperty({ enum: PurchasesOrderStatus })
  @IsEnum(PurchasesOrderStatus)
  status: PurchasesOrderStatus;
}

export class ListPurchasesPurchaseOrderDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PurchasesOrderStatus })
  @IsOptional()
  @IsEnum(PurchasesOrderStatus)
  status?: PurchasesOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;
}
