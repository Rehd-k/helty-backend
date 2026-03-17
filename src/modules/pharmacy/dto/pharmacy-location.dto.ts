import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PharmacyLocationType } from '@prisma/client';

export class CreatePharmacyLocationDto {
  @ApiProperty({ example: 'Main Dispensary' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: PharmacyLocationType })
  @IsEnum(PharmacyLocationType)
  locationType: PharmacyLocationType;

  @ApiPropertyOptional({ example: 'Ground floor, building A' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Staff ID assigned to this location (unique)',
  })
  @IsOptional()
  @IsUUID()
  staffId?: string;
}

export class UpdatePharmacyLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: PharmacyLocationType })
  @IsOptional()
  @IsEnum(PharmacyLocationType)
  locationType?: PharmacyLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  staffId?: string | null;
}
