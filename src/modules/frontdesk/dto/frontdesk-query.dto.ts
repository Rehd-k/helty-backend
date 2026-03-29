import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class FrontdeskQueryDto {
  @ApiPropertyOptional({
    description:
      'Anchor instant for "today" boundaries (ISO 8601). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
