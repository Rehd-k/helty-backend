import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabTestDto {
  @ApiProperty({ description: 'Lab category UUID' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Test name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Sample type (e.g. blood, urine, stool)' })
  @IsString()
  @IsNotEmpty()
  sampleType: string;

  @ApiPropertyOptional({ description: 'Test description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Price' })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Whether test is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
