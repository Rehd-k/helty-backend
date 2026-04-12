import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RadiologyRequestStatus } from '@prisma/client';
import { DateRangeSkipTakeDto } from '../../../common/dto/date-range.dto';

export class ListRadiologyRequestsQueryDto extends DateRangeSkipTakeDto {
  @ApiPropertyOptional({ enum: RadiologyRequestStatus })
  @IsEnum(RadiologyRequestStatus)
  @IsOptional()
  status?: RadiologyRequestStatus;

  @ApiPropertyOptional({ description: 'Filter by encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;
}
