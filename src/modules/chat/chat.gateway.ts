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

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { user?: OnlineUserInfo };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly staffService: StaffService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.query?.token as string);
    const username = (client.handshake.auth?.username as string)?.trim();

    if (token) {
      try {
        const secret =
          this.configService.get<string>('JWT_SECRET') || 'hard-to-guess-secret';
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
        client.emit('user_id', { userId: user.id, displayName: user.displayName });
        const onlineUsers = this.chatService.getOnlineUsers();
        this.server.emit('online_users', onlineUsers);
        return;
      } catch {
        this.logger.warn('Chat connection: invalid token, falling back to guest if username provided');
      }
    }

    if (username) {
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

    this.logger.warn('Chat connection rejected: no token and no username');
    client.disconnect(true);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.chatService.unregisterSocket(client.id);
    const onlineUsers = this.chatService.getOnlineUsers();
    this.server.emit('online_users', onlineUsers);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;
    const { recipientId, content } = dto;
    if (!recipientId || !content?.trim()) {
      client.emit('chat_error', { message: 'recipientId and content required' });
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
    const recipientSocketIds = this.chatService.getSocketIdsForUser(recipientId);
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
      client.emit('chat_error', { message: 'Not the recipient of this message' });
      return;
    }
    const senderSocketIds = this.chatService.getSocketIdsForUser(meta.senderId);
    senderSocketIds.forEach((sid) => {
      this.server.to(sid).emit('message_delivered', { messageId: dto.messageId });
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
      client.emit('chat_error', { message: 'Not the recipient of this message' });
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
    const recipientSocketIds = this.chatService.getSocketIdsForUser(dto.recipientId);
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
    const recipientSocketIds = this.chatService.getSocketIdsForUser(dto.recipientId);
    recipientSocketIds.forEach((sid) => {
      this.server.to(sid).emit('typing_stop', { userId: user.id });
    });
  }
}
