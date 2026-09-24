import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class FamilySubjectQueryDto {
  @ApiPropertyOptional({
    description: 'View as linked child patient UUID (parent accounts only)',
  })
  @IsOptional()
  @IsUUID()
  forPatientId?: string;
}

export class MedicationCalendarQueryDto extends FamilySubjectQueryDto {
  @ApiProperty({ description: 'Range start (inclusive)' })
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @ApiProperty({ description: 'Range end (inclusive)' })
  @Type(() => Date)
  @IsDate()
  to!: Date;
}

export class SetScheduleStartDto {
  @ApiProperty({
    description: 'When the patient should begin taking this medication',
  })
  @Type(() => Date)
  @IsDate()
  startAt!: Date;
}
