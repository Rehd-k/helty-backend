import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabAstResultOptionDto {
  @ApiProperty({
    description: 'Display label for the susceptibility result',
    example: 'Sensitive',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Short code shown on reports', example: 'S' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order in dropdowns', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
