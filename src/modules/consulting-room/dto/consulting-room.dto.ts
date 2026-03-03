import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConsultingRoomDto {
  @ApiProperty({
    description: 'Display name of the consulting room',
    example: 'Consulting Room 1',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the room',
    example: 'General outpatient consulting room',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Physical location of the room (e.g., floor/wing)',
    example: 'First floor, East wing',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'Maximum capacity of the room',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  capacity: number;

  @ApiPropertyOptional({
    description: 'Staff UUID assigned to this room (e.g., doctor)',
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

export class UpdateConsultingRoomDto {
  @ApiPropertyOptional({
    description: 'Updated display name of the consulting room',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated physical location of the room',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'Updated capacity of the room',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Staff UUID assigned to this room (e.g., doctor)',
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

export class QueryConsultingRoomDto {
  @ApiPropertyOptional({
    description:
      'Free-text search across name and location of the room',
    example: 'outpatient',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;
}

