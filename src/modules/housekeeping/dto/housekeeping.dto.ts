import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HousekeepingAreaKind,
  HousekeepingSupplyAction,
  ShiftType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateHousekeepingWorkerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHousekeepingWorkerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateHousekeepingAreaDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: HousekeepingAreaKind })
  @IsOptional()
  @IsEnum(HousekeepingAreaKind)
  kind?: HousekeepingAreaKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  consultingRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  theatreRoomId?: string;
}

export class UpdateHousekeepingAreaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: HousekeepingAreaKind })
  @IsOptional()
  @IsEnum(HousekeepingAreaKind)
  kind?: HousekeepingAreaKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  wardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  consultingRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  theatreRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class AssignHousekeepingAreaDto {
  @ApiProperty()
  @IsUUID()
  areaId: string;
}

export class QueryHousekeepingShiftDto {
  @ApiPropertyOptional({ example: '2026-09-09' })
  @IsOptional()
  @IsDateString()
  shiftDate?: string;

  @ApiPropertyOptional({ enum: ShiftType })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workerId?: string;
}

export class CreateHousekeepingShiftDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;

  @ApiProperty({ example: '2026-09-09' })
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

export class CreateHousekeepingSupplyLogDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  itemName: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 'bottles' })
  @IsString()
  unit: string;

  @ApiProperty({ enum: HousekeepingSupplyAction })
  @IsEnum(HousekeepingSupplyAction)
  action: HousekeepingSupplyAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
