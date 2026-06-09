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

export class CreateLabAntibioticDto {
  @ApiProperty({ description: 'Antibiotic display name', example: 'Amoxicillin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Short code', example: 'AMX' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Sort order in AST panels', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
