import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLabOrderItemNotesDto {
  @ApiPropertyOptional({
    description:
      'Scientist notes printed at the bottom of this test. Blank clears the note.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  scientistNotes?: string | null;
}
