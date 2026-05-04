import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StaffConversationMessageType } from '@prisma/client';

export class WsJoinConversationDto {
  @IsUUID()
  conversationId!: string;
}

export class WsSendPersistedMessageDto {
  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  content?: string;

  @IsOptional()
  @IsEnum(StaffConversationMessageType)
  type?: StaffConversationMessageType;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileUrl?: string;
}

export class WsTypingDto {
  @IsUUID()
  conversationId!: string;

  @IsBoolean()
  typing!: boolean;
}

export class WsMarkReadDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  lastReadMessageId!: string;
}

export class WsJoinTicketDto {
  @IsUUID()
  ticketId!: string;
}

export class WsSendTicketMessageDto {
  @IsUUID()
  ticketId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileUrl?: string;
}

export class WsPresencePingDto {
  @IsOptional()
  @IsString()
  clientTime?: string;
}
