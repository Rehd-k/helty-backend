import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NursingUnit, ShiftType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class QueryOutpatientNurseAssignmentDto {
  @ApiPropertyOptional({ enum: NursingUnit })
  @IsOptional()
  @IsEnum(NursingUnit)
  nursingUnit?: NursingUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nurseId?: string;
}

export class CreateOutpatientNurseAssignmentDto {
  @ApiProperty()
  @IsUUID()
  nurseId: string;

  @ApiProperty({ description: 'Paid consultation invoice ID (queue row)' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ enum: NursingUnit })
  @IsEnum(NursingUnit)
  nursingUnit: NursingUnit;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsDateString()
  shiftDate?: string;

  @ApiPropertyOptional({ enum: ShiftType })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;
}
