import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseNotePriority } from '@prisma/client';

export class CreatePurchaseNoteItemDto {
  @ApiPropertyOptional({ description: 'Link to store item if applicable' })
  @IsOptional()
  @IsUUID()
  storeItemId?: string;

  @ApiProperty({ description: 'Item description (required for ad-hoc items)' })
  @IsString()
  description: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedUnitCost?: number;

  @ApiPropertyOptional({
    enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
    default: 'NORMAL',
  })
  @IsOptional()
  priority?: PurchaseNotePriority;
}

export class CreatePurchaseNoteDto {
  @ApiProperty({ description: 'Department requesting the purchase' })
  @IsUUID()
  requestingDepartmentId: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  neededByDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [CreatePurchaseNoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseNoteItemDto)
  items: CreatePurchaseNoteItemDto[];
}
