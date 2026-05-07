import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReverseCoverageDto {
  @ApiPropertyOptional({ description: 'Reason for reversing this coverage' })
  @IsOptional()
  @IsString()
  reason?: string;
}

