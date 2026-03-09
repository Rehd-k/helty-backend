import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabTestVersionDto {
  @ApiPropertyOptional({ description: 'Set as active version (deactivates previous)', default: true })
  @IsOptional()
  @IsBoolean()
  setActive?: boolean;
}
