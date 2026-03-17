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

export class TransferItemLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;
}

export class TransferItemsDto {
  @ApiProperty({ description: 'Source store location' })
  @IsUUID()
  fromLocationId: string;

  @ApiProperty({ description: 'Destination store location' })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [TransferItemLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemLineDto)
  items: TransferItemLineDto[];
}
