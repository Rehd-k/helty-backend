import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsUUID,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateGroupConversationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  memberStaffIds!: string[];
}
