import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UpsertClinicalSectionDto {
  @ApiPropertyOptional({
    description: 'JSON payload for the section (replaces existing data)',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Schema version for forward-compatible clients',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiPropertyOptional({
    description:
      'Optional reason for amending a completed encounter (stored in edit history)',
  })
  @IsOptional()
  @IsString()
  editReason?: string;
}
