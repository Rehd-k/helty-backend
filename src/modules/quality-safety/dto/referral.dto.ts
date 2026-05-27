import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ReferralDirection, ReferralStatus } from '@prisma/client';

export class CreateReferralDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({ enum: ReferralDirection })
  @IsEnum(ReferralDirection)
  direction!: ReferralDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referringFacility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receivingFacility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class UpdateReferralDto extends PartialType(CreateReferralDto) {
  @ApiPropertyOptional({ enum: ReferralStatus })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;
}
