import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyRequestStatus } from '@prisma/client';

export class UpdateRadiologyRequestDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional({
    description:
      'Free-text doctor name printed on the result. Not linked to a staff record. Send an empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportDoctorName?: string;
}
