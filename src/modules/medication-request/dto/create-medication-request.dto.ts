import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsInt,
  IsPositive,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicationRequestStatus } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class CreateMedicationRequestDto {
  @ApiProperty({ description: 'Medication order UUID to request from' })
  @IsUUID()
  @IsNotEmpty()
  medicationOrderId: string;

  @ApiProperty({
    description: 'Billing units to dispense (entered by nurse)',
    example: 10,
  })
  @IsInt()
  @IsPositive()
  requestedQuantity: number;

  @ApiProperty({ description: 'Staff UUID of the requesting nurse' })
  @IsUUID()
  @IsNotEmpty()
  requestedByNurseId: string;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateMedicationRequestDto {
  @ApiProperty({
    description: 'Staff UUID performing the update (pharmacist or prescribing doctor)',
  })
  @IsUUID()
  @IsNotEmpty()
  modifiedByStaffId: string;

  @ApiPropertyOptional({
    description: 'Billing units (pharmacy may adjust before billing)',
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  requestedQuantity?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Alternative catalog drug; updates linked medication order before billing',
  })
  @IsUUID()
  @IsOptional()
  drugId?: string;

  @ApiPropertyOptional({
    description: 'Alias for drugId',
  })
  @IsUUID()
  @IsOptional()
  alternativeDrugId?: string;
}

export class ListMedicationRequestsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ description: 'Filter by encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ enum: MedicationRequestStatus })
  @IsEnum(MedicationRequestStatus)
  @IsOptional()
  status?: MedicationRequestStatus;
}

export class BillMedicationRequestsDto {
  @ApiProperty({ description: 'Encounter UUID — scopes the invoice' })
  @IsUUID()
  @IsNotEmpty()
  encounterId: string;

  @ApiProperty({ description: 'Staff UUID of the billing pharmacist' })
  @IsUUID()
  @IsNotEmpty()
  billedByStaffId: string;

  @ApiPropertyOptional({
    description:
      'Subset of request IDs to bill. When omitted, all REQUESTED requests for the encounter are billed.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  requestIds?: string[];
}
