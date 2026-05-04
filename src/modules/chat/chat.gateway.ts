import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { StaffService } from '../staff/staff.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageDeliveredDto, MessageReadDto } from './dto/message-status.dto';
import { TypingDto } from './dto/typing.dto';
import type { OnlineUserInfo } from './chat.types';
import { PresenceService } from './presence/presence.service';
import { StaffConversationMessageService } from './message/staff-conversation-message.service';
import { StaffConversationService } from './conversation/staff-conversation.service';
import { SupportTicketService } from './ticket/support-ticket.service';
import {
  WsJoinConversationDto,
  WsSendPersistedMessageDto,
  WsTypingDto,
  WsMarkReadDto,
  WsJoinTicketDto,
  WsSendTicketMessageDto,
  WsPresencePingDto,
} from './dto/ws-conversation.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { user?: OnlineUserInfo };
}

const convRoom = (id: string) => `conv:${id}`;
const ticketRoom = (id: string) => `ticket:${id}`;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  /** roomKey:userId -> last typing emit ms */
  private readonly typingThrottle = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly staffService: StaffService,
    private readonly chatService: ChatService,
    private readonly presence: PresenceService,
    private readonly conversationMessages: StaffConversationMessageService,
    private readonly conversations: StaffConversationService,
    private readonly tickets: SupportTicketService,
  ) {}

  private allowGuestConnection(): boolean {
    if (this.configService.get<string>('ALLOW_CHAT_GUEST') === 'true') {
      return true;
    }
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return false;
    }
    return this.configService.get<string>('ALLOW_CHAT_GUEST') !== 'false';
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);
    const username = (client.handshake.auth?.username as string)?.trim();

    if (token) {
      try {
        const secret =
          this.configService.get<string>('JWT_SECRET') ||
          'hard-to-guess-secret';
        const payload = await this.jwtService.verifyAsync(token, { secret });
        const staff = await this.staffService.findById(payload.sub);
        const user: OnlineUserInfo = {
          id: staff.id,
          staffId: staff.staffId,
          firstName: staff.firstName,
          lastName: staff.lastName,
          displayName: `${staff.firstName} ${staff.lastName}`.trim(),
        };
        client.data.user = user;
        this.chatService.registerSocket(user.id, client.id, {
          id: user.id,
          staffId: user.staffId,
          firstName: user.firstName,
          lastName: user.lastName,
        });
        client.emit('user_id', {
          userId: user.id,
          displayName: user.displayName,
        });
        const onlineUsers = this.chatService.getOnlineUsers();
        this.server.emit('online_users', onlineUsers);
        return;
      } catch {
        this.logger.warn(
          'Chat connection: invalid token, falling back to guest if allowed',
        );
      }
    }

    if (username && this.allowGuestConnection()) {
      const userId = this.chatService.registerGuestSocket(client.id, username);
      client.data.user = {
        id: userId,
        displayName: username,
      };
      client.emit('user_id', { userId, displayName: username });
      const onlineUsers = this.chatService.getOnlineUsers();
      this.server.emit('online_users', onlineUsers);
      return;
    }

    this.logger.warn('Chat connection rejected');
    client.disconnect(true);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.chatService.unregisterSocket(client.id);
    const onlineUsers = this.chatService.getOnlineUsers();
    this.server.emit('online_users', onlineUsers);
  }

  private staffOnly(client: AuthenticatedSocket): OnlineUserInfo | null {
    const user = client.data.user;
    if (!user || user.id.startsWith('guest-')) {
      client.emit('chat_error', { message: 'Staff authentication required' });
      return null;
    }
    return user;
  }

  private async validateDto<T extends object>(
    cls: new () => T,
    plain: unknown,
  ): Promise<T | null> {
    const inst = plainToInstance(cls, plain);
    const errors = await validate(inst);
    if (errors.length) {
      return null;
    }
    return inst;
  }

  @SubscribeMessage('joinConversation')
  async joinConversation(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsJoinConversationDto, body);
    if (!dto) {
      client.emit('chat_error', {
        message: 'Invalid joinConversation payload',
      });
      return;
    }
    try {
      await this.conversations.assertMember(dto.conversationId, user.id);
      await client.join(convRoom(dto.conversationId));
      client.emit('joinedConversation', { conversationId: dto.conversationId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Cannot join';
      client.emit('chat_error', { message: msg });
    }
  }

  @SubscribeMessage('leaveConversation')
  async leaveConversation(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsJoinConversationDto, body);
    if (!dto) return;
    await client.leave(convRoom(dto.conversationId));
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessageNew(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsSendPersistedMessageDto, body);
    if (!dto) {
      client.emit('chat_error', { message: 'Invalid sendMessage payload' });
      return;
    }
    try {
      const msg = await this.conversationMessages.send(
        dto.conversationId,
        user.id,
        {
          content: dto.content,
          type: dto.type,
          fileUrl: dto.fileUrl,
        },
      );
      const payload = {
        ...msg,
        createdAt: msg.createdAt.toISOString(),
      };
      client.emit('message_sent', payload);
      this.server
        .to(convRoom(dto.conversationId))
        .emit('receiveMessage', payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Send failed';
      client.emit('chat_error', { message: msg });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsTypingDto, body);
    if (!dto) return;
    const room = convRoom(dto.conversationId);
    const key = `${room}:${user.id}`;
    const now = Date.now();
    const last = this.typingThrottle.get(key) ?? 0;
    if (dto.typing && now - last < 3000) return;
    this.typingThrottle.set(key, now);
    client.to(room).emit('typing', {
      conversationId: dto.conversationId,
      userId: user.id,
      typing: dto.typing,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsMarkReadDto, body);
    if (!dto) {
      client.emit('chat_error', { message: 'Invalid markRead payload' });
      return;
    }
    try {
      const result = await this.conversationMessages.markReadUpTo(
        dto.conversationId,
        user.id,
        dto.lastReadMessageId,
      );
      client.to(convRoom(dto.conversationId)).emit('readReceipt', {
        conversationId: dto.conversationId,
        readerId: user.id,
        lastReadMessageId: dto.lastReadMessageId,
        markedCount: result.markedCount,
      });
      client.emit('markReadAck', result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'markRead failed';
      client.emit('chat_error', { message: msg });
    }
  }

  @SubscribeMessage('presenceHeartbeat')
  async presenceHeartbeat(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    await this.validateDto(WsPresencePingDto, body);
    await this.presence.heartbeat(user.id);
    const p = await this.presence.getPresence(user.id);
    this.server.emit('presenceUpdate', {
      staffId: user.id,
      status: p.status,
      lastSeen: p.lastSeen,
    });
  }

  @SubscribeMessage('joinTicket')
  async joinTicket(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsJoinTicketDto, body);
    if (!dto) {
      client.emit('chat_error', { message: 'Invalid joinTicket payload' });
      return;
    }
    try {
      await this.tickets.assertTicketAccess(dto.ticketId, user.id);
      await client.join(ticketRoom(dto.ticketId));
      client.emit('joinedTicket', { ticketId: dto.ticketId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Cannot join ticket';
      client.emit('chat_error', { message: msg });
    }
  }

  @SubscribeMessage('sendTicketMessage')
  async sendTicketMessage(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = this.staffOnly(client);
    if (!user) return;
    const dto = await this.validateDto(WsSendTicketMessageDto, body);
    if (!dto) {
      client.emit('chat_error', {
        message: 'Invalid sendTicketMessage payload',
      });
      return;
    }
    try {
      const msg = await this.tickets.addMessage(
        dto.ticketId,
        user.id,
        dto.content,
        dto.fileUrl,
      );
      const payload = {
        ...msg,
        createdAt: msg.createdAt.toISOString(),
        ticketId: dto.ticketId,
      };
      client.emit('ticketMessageSent', payload);
      this.server.to(ticketRoom(dto.ticketId)).emit('ticketMessage', payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ticket message failed';
      client.emit('chat_error', { message: msg });
    }
  }

  // --- Legacy 1:1 ephemeral chat (non-persisted) ---

  @SubscribeMessage('send_message')
  async handleSendMessageLegacy(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;

    const anyBody = dto as unknown as {
      conversationId?: string;
      content?: string;
      type?: string;
      fileUrl?: string;
    };
    if (anyBody.conversationId && !user.id.startsWith('guest-')) {
      this.logger.debug('send_message alias -> persisted sendMessage');
      await this.handleSendMessageNew(
        {
          conversationId: anyBody.conversationId,
          content: anyBody.content,
          fileUrl: anyBody.fileUrl,
        },
        client,
      );
      return;
    }

    const { recipientId, content } = dto;
    if (!recipientId || !content?.trim()) {
      client.emit('chat_error', {
        message: 'recipientId and content required',
      });
      return;
    }
    if (recipientId === user.id) {
      client.emit('chat_error', { message: 'Cannot send message to yourself' });
      return;
    }
    const messageId = this.chatService.generateMessageId();
    this.chatService.registerMessage(messageId, user.id, recipientId);
    const createdAt = new Date().toISOString();
    const payload = {
      messageId,
      senderId: user.id,
      recipientId,
      content: content.trim(),
      status: 'SENT' as const,
      createdAt,
    };
    client.emit('message_sent', payload);
    const recipientSocketIds =
      this.chatService.getSocketIdsForUser(recipientId);
    recipientSocketIds.forEach((sid) => {
      this.server.to(sid).emit('new_message', payload);
    });
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @MessageBody() dto: MessageDeliveredDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;
    const meta = this.chatService.getMessageMeta(dto.messageId);
    if (!meta) return;
    if (meta.recipientId !== user.id) {
      client.emit('chat_error', {
        message: 'Not the recipient of this message',
      });
      return;
    }
    const senderSocketIds = this.chatService.getSocketIdsForUser(meta.senderId);
    senderSocketIds.forEach((sid) => {
      this.server
        .to(sid)
        .emit('message_delivered', { messageId: dto.messageId });
    });
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @MessageBody() dto: MessageReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;
    const meta = this.chatService.getMessageMeta(dto.messageId);
    if (!meta) return;
    if (meta.recipientId !== user.id) {
      client.emit('chat_error', {
        message: 'Not the recipient of this message',
      });
      return;
    }
    const senderSocketIds = this.chatService.getSocketIdsForUser(meta.senderId);
    senderSocketIds.forEach((sid) => {
      this.server.to(sid).emit('message_read', { messageId: dto.messageId });
    });
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user || dto.recipientId === user.id) return;
    const recipientSocketIds = this.chatService.getSocketIdsForUser(
      dto.recipientId,
    );
    recipientSocketIds.forEach((sid) => {
      this.server.to(sid).emit('user_typing', { userId: user.id });
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() dto: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user || dto.recipientId === user.id) return;
    const recipientSocketIds = this.chatService.getSocketIdsForUser(
      dto.recipientId,
    );
    recipientSocketIds.forEach((sid) => {
      this.server.to(sid).emit('typing_stop', { userId: user.id });
    });
  }
}
