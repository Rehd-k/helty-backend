import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBedDto {
  @ApiProperty({ description: 'Ward ID this bed belongs to' })
  @IsString()
  wardId: string;

  @ApiProperty({ description: 'Bed number within the ward' })
  @IsString()
  bedNumber: string;

  @ApiProperty({
    description: 'Current bed status',
    enum: ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED'])
  status?: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'RESERVED';
}
