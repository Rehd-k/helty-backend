import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NursingUnit, ShiftType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class QueryNurseShiftRosterDto {
  @ApiPropertyOptional({ enum: NursingUnit })
  @IsOptional()
  @IsEnum(NursingUnit)
  nursingUnit?: NursingUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsDateString()
  shiftDate?: string;

  @ApiPropertyOptional({ enum: ShiftType })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;
}

export class CreateNurseShiftRosterDto {
  @ApiProperty()
  @IsUUID()
  nurseId: string;

  @ApiProperty({ enum: NursingUnit })
  @IsEnum(NursingUnit)
  nursingUnit: NursingUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  shiftDate: string;

  @ApiProperty({ enum: ShiftType })
  @IsEnum(ShiftType)
  shiftType: ShiftType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateNurseShiftRosterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nurseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
