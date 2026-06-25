import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWardRoundNoteDto {
  /** ISO date YYYY-MM-DD (calendar day of the round) */
  @ApiPropertyOptional({ example: '2026-06-25' })
  @IsDateString({ strict: true }, { message: 'roundDate must be YYYY-MM-DD' })
  @IsOptional()
  roundDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subjective?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  objective?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assessment?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  plan?: string;
}
