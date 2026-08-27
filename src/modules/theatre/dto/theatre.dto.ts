import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsBoolean,
  IsDateString,
  IsObject,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TheatreCaseStaffRole } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class CreateTheatreRoomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTheatreRoomDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ScheduleSurgeryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  surgeryRequestId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  theatreRoomId: string;

  @ApiProperty({ description: 'Scheduled start time (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'Estimated duration in minutes' })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedDurationMins?: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  surgeonId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  anaesthetistId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  scrubNurseId?: string;
}

export class UpdateTheatreScheduleDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  theatreRoomId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedDurationMins?: number;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  surgeonId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  anaesthetistId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  scrubNurseId?: string;
}

export class ListTheatreSchedulesQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  theatreRoomId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  surgeonId?: string;
}

export class UpdateTheatreCaseDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  findings?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  complications?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  operativeNotes?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  performedById?: string;

  @ApiPropertyOptional({
    description: 'Surgical team members to upsert on the case',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        staffId: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: Object.values(TheatreCaseStaffRole) },
      },
    },
  })
  @IsOptional()
  team?: Array<{ staffId: string; role: TheatreCaseStaffRole }>;
}

export class AddCaseConsumableDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  consumableId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  storeLocationId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'When false, deduct stock immediately without billing',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  billable?: boolean;

  @ApiPropertyOptional({ description: 'Override unit price for billable items' })
  @IsOptional()
  unitPrice?: number;
}

export class BillSurgeryDto {
  @ApiPropertyOptional({ description: 'Staff performing billing (defaults to JWT user)' })
  @IsUUID()
  @IsOptional()
  billedByStaffId?: string;
}

export class TransferAfterSurgeryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  admissionId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  wardId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  bedId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  transferNotes?: string;
}

export class UpsertTheatreOperativeNoteDto {
  @ApiPropertyOptional({
    description: 'Structured questionnaire answers keyed by section id',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  answersJson: Record<string, unknown>;

  @ApiProperty({ description: 'Compiled clinical narrative from the questionnaire' })
  @IsString()
  narrative: string;

  @ApiPropertyOptional({ description: 'Free-hand notes not covered by the form' })
  @IsString()
  @IsOptional()
  additionalNotes?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;
}
