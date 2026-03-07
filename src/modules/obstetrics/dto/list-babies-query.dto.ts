import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListBabiesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  motherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  labourDeliveryId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}
