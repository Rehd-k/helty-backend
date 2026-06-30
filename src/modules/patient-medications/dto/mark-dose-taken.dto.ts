import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class MarkDoseTakenDto {
  @ApiPropertyOptional({ description: 'When the dose was taken; defaults to server time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  takenAt?: Date;
}
