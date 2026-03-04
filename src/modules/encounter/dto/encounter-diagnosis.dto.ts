import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEncounterDiagnosisDto {
  @ApiProperty({ description: 'Diagnosis code or text' })
  @IsString()
  @IsNotEmpty()
  diagnosis: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary diagnosis', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateEncounterDiagnosisDto {
  @ApiPropertyOptional({ description: 'Diagnosis code or text' })
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary diagnosis' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
