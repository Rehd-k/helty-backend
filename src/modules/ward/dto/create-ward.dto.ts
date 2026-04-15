import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { isFloat16Array } from 'util/types';

export class CreateWardDto {
  @ApiProperty({ description: 'Ward name (e.g. Male Medical, ICU)' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Maximum number of beds in the ward',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  capacity: number;

  @ApiProperty({
    description: 'Drug price percentage',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  drugPricePercentage?: number;

  @ApiProperty({
    description: 'Ward type',
    enum: ['GENERAL', 'ICU', 'ISOLATION'],
  })
  @IsEnum(['GENERAL', 'ICU', 'ISOLATION'])
  type: 'GENERAL' | 'ICU' | 'ISOLATION';

  @ApiProperty({
    description: 'Optional department this ward belongs to',
    required: false,
  })
  @IsOptional()
  @IsString()
  departmentId?: string;
}

