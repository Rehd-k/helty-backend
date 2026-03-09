import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LabOrderItemDto {
  @ApiProperty({ description: 'Lab test version UUID (must be active)' })
  @IsUUID()
  @IsNotEmpty()
  testVersionId: string;
}

export class CreateLabOrderDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor (staff) UUID' })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    type: [LabOrderItemDto],
    description: 'At least one test (by active test version)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one test' })
  @ValidateNested({ each: true })
  @Type(() => LabOrderItemDto)
  items: LabOrderItemDto[];
}
