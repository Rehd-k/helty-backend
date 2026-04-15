import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarkConversationReadDto {
  @ApiProperty({ description: 'Last message id the client has displayed' })
  @IsUUID()
  lastReadMessageId!: string;
}
