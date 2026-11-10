import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabOrderStatus } from '@prisma/client';

export class UpdateLabOrderDto {
  @ApiPropertyOptional({ enum: LabOrderStatus })
  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;

  @ApiPropertyOptional({
    description:
      'Free-text doctor name printed on the result. Not linked to a staff record. Send an empty string to clear.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reportDoctorName?: string;
}
