import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBedDto {
  @ApiPropertyOptional({ description: 'Bed number within the ward' })
  @IsOptional()
  @IsString()
  bedNumber?: string;

  @ApiPropertyOptional({
    description: 'Current bed status',
    enum: ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED'],
  })
  @IsOptional()
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED'])
  status?: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'RESERVED';
}
