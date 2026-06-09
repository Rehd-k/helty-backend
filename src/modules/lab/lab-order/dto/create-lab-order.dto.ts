import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LabOrderItemDto {
  @ApiProperty({ description: 'Lab test version UUID (must be active)' })
  @IsUUID()
  @IsNotEmpty()
  testVersionId: string;

  @ApiPropertyOptional({
    description:
      'When true, Antibiotic Susceptibility Testing (AST) may be recorded for this line. Use for MCS and similar culture tests where susceptibility is ordered prospectively.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  astRequested?: boolean;
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
      'Invoice UUID — use with invoiceItemId and serviceId. Links a billed lab request line; payment is enforced when results are entered (outpatients must pay first).',
  })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({
    description:
      'Laboratory invoice line item UUID from the lab request or paid counter flow',
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
