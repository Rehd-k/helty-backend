import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Unit cost of received items' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost: number;
}

export class ReceiveItemsDto {
  @ApiProperty({ description: 'Store location receiving the items' })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional({ description: 'Department returning items (for returns)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'e.g. PURCHASE_NOTE' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'e.g. purchase note id' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ type: [ReceiveItemLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemLineDto)
  items: ReceiveItemLineDto[];
}
