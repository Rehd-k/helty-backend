import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PresenceService } from './presence/presence.service';
import { StaffConversationService } from './conversation/staff-conversation.service';
import { StaffConversationMessageService } from './message/staff-conversation-message.service';
import { SupportTicketService } from './ticket/support-ticket.service';
import { SupportTicketController } from './ticket/support-ticket.controller';

@Module({
  imports: [ConfigModule, AuthModule, StaffModule, PrismaModule],
  providers: [
    ChatGateway,
    ChatService,
    PresenceService,
    StaffConversationService,
    StaffConversationMessageService,
    SupportTicketService,
  ],
  controllers: [ChatController, SupportTicketController],
  exports: [
    ChatService,
    StaffConversationService,
    PresenceService,
    SupportTicketService,
  ],
})
export class ChatModule {}
