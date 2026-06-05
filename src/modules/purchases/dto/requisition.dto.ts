import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RequisitionItemType,
  RequisitionLinePriority,
  RequestingDepartment,
  RequisitionStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

const ITEM_TYPE_ALIASES: Record<string, RequisitionItemType> = {
  Drug: RequisitionItemType.DRUG,
  DRUG: RequisitionItemType.DRUG,
  Consumable: RequisitionItemType.CONSUMABLE,
  CONSUMABLE: RequisitionItemType.CONSUMABLE,
  PurchaseItem: RequisitionItemType.PURCHASE_ITEM,
  PURCHASE_ITEM: RequisitionItemType.PURCHASE_ITEM,
};

export class CreateRequisitionLineDto {
  @ApiProperty({ enum: RequisitionItemType, description: 'Drug | Consumable | PurchaseItem or enum value' })
  @Transform(({ value }) => ITEM_TYPE_ALIASES[String(value)] ?? value)
  @IsEnum(RequisitionItemType)
  itemType: RequisitionItemType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  itemId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  itemName: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ enum: RequisitionLinePriority })
  @IsOptional()
  @IsEnum(RequisitionLinePriority)
  priority?: RequisitionLinePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRequisitionDto {
  @ApiProperty({ enum: RequestingDepartment })
  @IsEnum(RequestingDepartment)
  requestingDepartment: RequestingDepartment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateRequisitionLineDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionLineDto)
  @ArrayMinSize(1)
  lines: CreateRequisitionLineDto[];
}

export class RejectRequisitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConvertRequisitionToPoDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;
}

export class ListRequisitionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RequisitionStatus })
  @IsOptional()
  @IsEnum(RequisitionStatus)
  status?: RequisitionStatus;

  @ApiPropertyOptional({ enum: RequestingDepartment })
  @IsOptional()
  @IsEnum(RequestingDepartment)
  requestingDepartment?: RequestingDepartment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;
}
