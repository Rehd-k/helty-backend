import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RegisteredTodayQueryDto {
  @ApiPropertyOptional({
    description:
      'Anchor instant for "today" boundaries (ISO 8601). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @ApiPropertyOptional({
    description: 'Search by name, hospital patient ID, or phone number',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
