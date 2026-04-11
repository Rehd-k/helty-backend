import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyRequestStatus } from '@prisma/client';

export class UpdateRadiologyRequestDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;
}
