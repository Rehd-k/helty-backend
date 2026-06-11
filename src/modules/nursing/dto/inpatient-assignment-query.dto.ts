import { ApiPropertyOptional } from '@nestjs/swagger';
import { NursingUnit, ShiftType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class QueryInpatientNurseAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional({ enum: NursingUnit })
  @IsOptional()
  @IsEnum(NursingUnit)
  nursingUnit?: NursingUnit;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsDateString()
  shiftDate?: string;

  @ApiPropertyOptional({ enum: ShiftType })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;
}
