import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefillRequestDto {
  @ApiPropertyOptional({ example: 'Running low, please refill before trip' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
