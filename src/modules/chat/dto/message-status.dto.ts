import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MessageDeliveredDto {
  @ApiProperty({ description: 'Id of the message to mark as delivered' })
  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class MessageReadDto {
  @ApiProperty({ description: 'Id of the message to mark as read' })
  @IsString()
  @IsNotEmpty()
  messageId: string;
}
