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

export class IssueItemLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit cost at time of issue; if omitted, uses current stock average' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

export class IssueItemsDto {
  @ApiProperty({ description: 'Department receiving the items' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ description: 'Store location issuing from' })
  @IsUUID()
  fromLocationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [IssueItemLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueItemLineDto)
  items: IssueItemLineDto[];
}
