import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Icd10GroupsQueryDto {
  @ApiProperty({ example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  specialty: string;
}
