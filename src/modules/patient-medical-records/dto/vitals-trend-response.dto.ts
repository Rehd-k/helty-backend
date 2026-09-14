import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class VitalsTrendQueryDto {
  @ApiPropertyOptional({
    description:
      'View vitals for a linked child (defaults to the logged-in patient)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  forPatientId?: string;

  @ApiPropertyOptional({ default: 40, minimum: 2, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  limit?: number = 40;
}

export class VitalsTrendPointDto {
  @ApiProperty()
  recordedAt!: Date;

  @ApiPropertyOptional()
  pulseRate?: number | null;

  @ApiPropertyOptional()
  systolic?: number | null;

  @ApiPropertyOptional()
  diastolic?: number | null;
}

export class VitalsTrendResponseDto {
  @ApiProperty({ type: [VitalsTrendPointDto] })
  data!: VitalsTrendPointDto[];
}
