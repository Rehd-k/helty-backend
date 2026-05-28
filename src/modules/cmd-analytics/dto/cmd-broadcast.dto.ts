import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CmdBroadcastDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({ example: 'all_staff' })
  @IsString()
  @IsNotEmpty()
  audience!: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'], example: 'high' })
  @IsString()
  @IsIn(['critical', 'high', 'medium', 'low'])
  priority!: string;
}
