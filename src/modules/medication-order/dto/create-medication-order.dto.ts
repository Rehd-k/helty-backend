import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsIn,
  MaxLength,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MEDICATION_ORDER_STATUSES = [
  'Pending Dispense',
  'Dispensed',
  'Cancelled',
] as const;
export const MEDICATION_ADMINISTRATION_STATUSES = [
  'ACTIVE',
  'STOPPED',
] as const;
export type MedicationOrderStatus = (typeof MEDICATION_ORDER_STATUSES)[number];

export class CreateMedicationOrderDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty({ message: 'patientId is required' })
  patientId: string;

  @ApiProperty({ description: 'Doctor UUID' })
  @IsUUID()
  @IsNotEmpty({ message: 'doctorId is required' })
  doctorId: string;

  @ApiProperty({ description: 'Encounter UUID' })
  @IsUUID()
  @IsNotEmpty({ message: 'encounterId is required' })
  encounterId: string;

  @ApiPropertyOptional({ description: 'Admission UUID for inpatient orders' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty({ description: 'Drug catalog UUID' })
  @IsUUID()
  @IsNotEmpty({ message: 'drugId is required' })
  drugId: string;

  @ApiPropertyOptional({ description: 'Dose (e.g. 500mg, 2 tablets)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  dose?: string;

  @ApiPropertyOptional({ description: 'Frequency (e.g. TID, twice daily)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  frequency?: string;

  @ApiPropertyOptional({ description: 'Quantity (e.g 1 ,2,3)' })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Duration (e.g. 7 days, 2 weeks)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  duration?: string;

  @ApiPropertyOptional({ description: 'Route (e.g. PO, IV, topical)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  route?: string;

  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Order start datetime (ISO)' })
  @IsDateString()
  @IsOptional()
  startDateTime?: string;

  @ApiPropertyOptional({ description: 'Order end datetime (ISO)' })
  @IsDateString()
  @IsOptional()
  endDateTime?: string;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: MEDICATION_ADMINISTRATION_STATUSES })
  @IsIn(MEDICATION_ADMINISTRATION_STATUSES)
  @IsOptional()
  administrationStatus?: (typeof MEDICATION_ADMINISTRATION_STATUSES)[number];
}

export class UpdateMedicationOrderDto {
  @ApiPropertyOptional({
    description:
      'Replace the ordered drug; `drugName` is refreshed from the drug catalog (generic name).',
  })
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({
    enum: MEDICATION_ORDER_STATUSES,
    description: 'Order status',
  })
  @IsIn(MEDICATION_ORDER_STATUSES, {
    message: `status must be one of: ${MEDICATION_ORDER_STATUSES.join(', ')}`,
  })
  @IsOptional()
  status?: MedicationOrderStatus;

  @ApiPropertyOptional({ description: 'Dose (e.g. 500mg, 2 tablets)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  dose?: string;

  @ApiPropertyOptional({ description: 'Frequency (e.g. TID, twice daily)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  frequency?: string;

  @ApiPropertyOptional({ description: 'Duration (e.g. 7 days, 2 weeks)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  duration?: string;

  @ApiPropertyOptional({ description: 'Route (e.g. PO, IV, topical)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  route?: string;

  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  specialInstructions?: string;

  @ApiPropertyOptional({ enum: MEDICATION_ADMINISTRATION_STATUSES })
  @IsIn(MEDICATION_ADMINISTRATION_STATUSES)
  @IsOptional()
  administrationStatus?: (typeof MEDICATION_ADMINISTRATION_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Order end datetime (ISO)' })
  @IsDateString()
  @IsOptional()
  endDateTime?: string;

  @ApiPropertyOptional({ description: 'Clinical notes' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
