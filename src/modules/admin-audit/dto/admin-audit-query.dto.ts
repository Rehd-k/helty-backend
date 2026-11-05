import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminAuditQueryDto {
  @ApiPropertyOptional({
    description:
      'Range start (ISO 8601). A date-only value is the start of that day in Africa/Lagos. Defaults to 7 days ago.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Range end (ISO 8601). A date-only value is the end of that day in Africa/Lagos. Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Staff.id of the person who performed the change',
  })
  @IsOptional()
  @IsUUID()
  performedById?: string;

  @ApiPropertyOptional({ example: 'UPDATE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;

  @ApiPropertyOptional({
    example: 'Patient',
    description: 'Model name, matched as a substring',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entity?: string;

  @ApiPropertyOptional({
    description: 'Matches summary, entity, record id, action, or staff name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;
}
