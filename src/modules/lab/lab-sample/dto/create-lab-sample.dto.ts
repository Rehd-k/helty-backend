import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabSampleDto {
  @ApiProperty({ description: 'Lab order item UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({ description: 'Sample type (e.g. blood, urine)' })
  @IsString()
  @IsNotEmpty()
  sampleType: string;

  @ApiProperty({ description: 'Staff UUID who collected the sample' })
  @IsUUID()
  @IsNotEmpty()
  collectedBy: string;

  @ApiProperty({ description: 'Collection time (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  collectionTime: string;

  @ApiPropertyOptional({ description: 'Barcode' })
  @IsString()
  @IsOptional()
  barcode?: string;
}
