import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TypingDto {
  @ApiProperty({ description: 'User id of the recipient (who will see the typing indicator)' })
  @IsString()
  recipientId: string;
}
