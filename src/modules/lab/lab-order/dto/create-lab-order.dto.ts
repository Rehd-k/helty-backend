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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    description:
      'Invoice UUID — use with invoiceItemId and serviceId. Outpatients: line must be on a paid invoice. Actively admitted inpatients: pending encounter-billed lines are allowed.',
  })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description:
      'Laboratory invoice line item UUID (paid for outpatients; pending or paid for actively admitted inpatients)',
  })
  @IsUUID()
  @IsOptional()
  invoiceItemId?: string;

  @ApiPropertyOptional({
    description:
      'Service UUID on the invoice line (must match the billed laboratory service)',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;
}
