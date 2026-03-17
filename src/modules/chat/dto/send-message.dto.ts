import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description:
      'User id of the recipient (staff uuid or guest-xxx for test mode)',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({ description: 'Message content', maxLength: 10000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
