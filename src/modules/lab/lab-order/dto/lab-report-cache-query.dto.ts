import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((part) => String(part).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

export class LabReportCacheQueryDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({
    description:
      'Lab order item UUIDs included in the report (comma-separated or repeated query params)',
    type: [String],
  })
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderItemIds: string[];
}
