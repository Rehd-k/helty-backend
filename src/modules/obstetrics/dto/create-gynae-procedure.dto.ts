import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGynaeProcedureDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  procedureType: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  procedureDate: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  surgeonId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assistantId?: string;

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
  notes?: string;
}

export class UpdateGynaeProcedureDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  procedureDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  procedureType?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  surgeonId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assistantId?: string;

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
  notes?: string;
}
