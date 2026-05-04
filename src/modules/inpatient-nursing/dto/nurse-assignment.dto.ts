import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ShiftType } from '@prisma/client';

export class CreateNurseAssignmentDto {
  @ApiProperty({
    description:
      'Staff id of the nurse to assign (Staff.id of a staff whose accountType is NURSE).',
  })
  @IsUUID()
  nurseId: string;

  @ApiProperty({
    description: 'Calendar day for the shift (ISO date or datetime)',
  })
  @IsDateString()
  shiftDate: string;

  @ApiProperty({ enum: ShiftType })
  @IsEnum(ShiftType)
  shiftType: ShiftType;
}
