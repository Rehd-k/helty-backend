import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArchivedEncounterDto {
  @ApiProperty({
    description: 'When the original clinical encounter occurred (ISO 8601)',
    example: '2019-06-15T10:30:00.000Z',
  })
  @IsDateString()
  encounterOccurredAt: string;

  @ApiPropertyOptional({ example: 'OPD visit – Dr. Ade' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
