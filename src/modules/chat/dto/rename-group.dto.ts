import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RenameGroupDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}
