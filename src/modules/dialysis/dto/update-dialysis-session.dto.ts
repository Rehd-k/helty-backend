import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DialysisSessionStatus } from '@prisma/client';

export class UpdateDialysisSessionDto {
  @ApiPropertyOptional({ enum: DialysisSessionStatus })
  @IsOptional()
  @IsEnum(DialysisSessionStatus)
  status?: DialysisSessionStatus;

  @ApiPropertyOptional({ description: 'Free-text session notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Dialysis nurse/tech (staff) UUID' })
  @IsOptional()
  @IsUUID()
  performedById?: string;

  @ApiPropertyOptional({ description: 'Optional machine identifier' })
  @IsOptional()
  @IsString()
  machineId?: string;
}
