import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LabResultItemDto {
  @ApiProperty({ description: 'Lab test field UUID' })
  @IsUUID()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({ description: 'Result value' })
  @IsString()
  @IsOptional()
  value?: string;
}

export class CreateLabResultBatchDto {
  @ApiProperty({ description: 'Lab order item UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({ description: 'Staff UUID who entered the results' })
  @IsUUID()
  @IsNotEmpty()
  enteredBy: string;

  @ApiProperty({
    type: [LabResultItemDto],
    description: 'Field id and value pairs',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LabResultItemDto)
  results: LabResultItemDto[];
}
