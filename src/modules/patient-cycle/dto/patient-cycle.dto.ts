import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientCycleFlow } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_CYCLE_LENGTH_DAYS,
  DEFAULT_PERIOD_LENGTH_DAYS,
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '../patient-cycle.constants';

export { PatientCycleFlow };

export class CycleCalendarQueryDto {
  @ApiPropertyOptional({ minimum: 2000, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class UpdateCycleSettingsDto {
  @ApiProperty({
    minimum: MIN_CYCLE_LENGTH_DAYS,
    maximum: MAX_CYCLE_LENGTH_DAYS,
    default: DEFAULT_CYCLE_LENGTH_DAYS,
  })
  @IsInt()
  @Min(MIN_CYCLE_LENGTH_DAYS)
  @Max(MAX_CYCLE_LENGTH_DAYS)
  cycleLengthDays!: number;

  @ApiProperty({
    minimum: MIN_PERIOD_LENGTH_DAYS,
    maximum: MAX_PERIOD_LENGTH_DAYS,
    default: DEFAULT_PERIOD_LENGTH_DAYS,
  })
  @IsInt()
  @Min(MIN_PERIOD_LENGTH_DAYS)
  @Max(MAX_PERIOD_LENGTH_DAYS)
  periodLengthDays!: number;
}

export class CreateCyclePeriodDto {
  @ApiProperty({ description: 'Period start (YYYY-MM-DD)' })
  @IsDateString({ strict: true }, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @ApiPropertyOptional({ description: 'Period end (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ enum: PatientCycleFlow })
  @IsOptional()
  @IsEnum(PatientCycleFlow)
  flow?: PatientCycleFlow;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateCyclePeriodDto {
  @ApiPropertyOptional({ description: 'Period start (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Period end (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string | null;

  @ApiPropertyOptional({ enum: PatientCycleFlow, nullable: true })
  @IsOptional()
  @IsEnum(PatientCycleFlow)
  flow?: PatientCycleFlow | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
