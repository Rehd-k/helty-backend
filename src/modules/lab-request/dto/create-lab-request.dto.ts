import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LabRequestStatus } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class CreateLabRequestDto {
  @ApiPropertyOptional({
    description:
      'Pregnancy UUID — resolves encounterId from the pregnancy antenatal encounter when encounterId is omitted.',
  })
  @IsUUID()
  @IsOptional()
  pregnancyId?: string;

  @ApiPropertyOptional({ description: 'Encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiProperty({ description: 'Patient UUID (must match encounter patient)' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Staff UUID of the requesting doctor' })
  @IsUUID()
  @IsNotEmpty()
  requestedByDoctorId: string;

  @ApiPropertyOptional({ description: 'Type of lab test' })
  @IsString()
  @IsOptional()
  testType?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Laboratory service UUID — creates a pending encounter invoice line for any patient. Outpatients must pay before lab results are entered; actively admitted inpatients may receive results on credit.',
  })
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @ApiPropertyOptional({
    description:
      'When true with a package-covered serviceId, bills at zero via the default antenatal package.',
  })
  @IsBoolean()
  @IsOptional()
  useAntenatalPackage?: boolean;
}

export class ListLabRequestsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ description: 'Filter by encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;
}

export class UpdateLabRequestDto {
  @ApiPropertyOptional({ enum: LabRequestStatus })
  @IsEnum(LabRequestStatus)
  @IsOptional()
  status?: LabRequestStatus;

  @ApiPropertyOptional({ description: 'Type of lab test' })
  @IsString()
  @IsOptional()
  testType?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
