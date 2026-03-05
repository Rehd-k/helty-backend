import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateDrugInteractionDto {
  @ApiProperty()
  @IsUUID()
  drugAId: string;

  @ApiProperty()
  @IsUUID()
  drugBId: string;

  @ApiProperty({ example: 'moderate', description: 'Severity of interaction' })
  @IsString()
  severity: string;
}
