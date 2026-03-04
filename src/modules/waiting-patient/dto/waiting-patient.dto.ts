import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsPositive,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateWaitingPatientDto {
  @ApiProperty({
    description:
      'Patient UUID being added to the waiting list (not yet in a consulting room)',
  })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({
    description:
      'Staff UUID of the user adding this waiting patient entry (for audit)',
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

/** Use only after patient has vitals recorded. See POST /waiting-patients/:id/send-to-room */
export class SendToConsultingRoomDto {
  @ApiProperty({
    description: 'Consulting room UUID to send this waiting patient to',
  })
  @IsString()
  @IsNotEmpty()
  consultingRoomId: string;

  @ApiPropertyOptional({
    description: 'Staff UUID of the user sending the patient to the room',
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

export class UpdateWaitingPatientDto {
  @ApiPropertyOptional({
    description:
      'Consulting room UUID to move the waiting patient to (vitals must exist before assigning a room)',
  })
  @IsString()
  @IsOptional()
  consultingRoomId?: string;

  @ApiPropertyOptional({
    description: 'Whether the patient has been seen by the doctor',
  })
  @IsBoolean()
  @IsOptional()
  seen?: boolean;

  @ApiPropertyOptional({
    description:
      'Staff UUID of the user updating this waiting patient entry',
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

export class QueryWaitingPatientDto {
  @ApiPropertyOptional({
    description: 'Filter by consulting room UUID',
  })
  @IsString()
  @IsOptional()
  consultingRoomId?: string;

  @ApiPropertyOptional({
    description: 'If true, return only waiting patients not yet sent to a room',
  })
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  @IsOptional()
  unassignedOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by patient UUID',
  })
  @IsString()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;
}

