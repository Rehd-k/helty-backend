import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { OnlineUserInfo } from './chat.types';

interface UserSocketEntry {
  socketIds: Set<string>;
  staff: OnlineUserInfo;
}

interface MessageMeta {
  senderId: string;
  recipientId: string;
}

@Injectable()
export class ChatService {
  /** userId (Staff.id) -> { socketIds, staff } */
  private readonly userSockets = new Map<string, UserSocketEntry>();

  /** socketId -> userId, for disconnect lookup */
  private readonly socketToUser = new Map<string, string>();

  /** messageId -> { senderId, recipientId } for routing delivered/read */
  private readonly messageMeta = new Map<string, MessageMeta>();

  registerSocket(
    userId: string,
    socketId: string,
    staff: Partial<OnlineUserInfo> & { id: string },
    displayNameOverride?: string,
  ): void {
    this.socketToUser.set(socketId, userId);
    const existing = this.userSockets.get(userId);
    const displayName =
      displayNameOverride ??
      (staff.firstName && staff.lastName
        ? `${staff.firstName} ${staff.lastName}`.trim()
        : (staff.displayName ?? userId));
    const staffInfo: OnlineUserInfo = {
      id: staff.id,
      displayName,
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
    };
    if (existing) {
      existing.socketIds.add(socketId);
    } else {
      this.userSockets.set(userId, {
        socketIds: new Set([socketId]),
        staff: staffInfo,
      });
    }
  }

  /** For test mode: connect with username only (no JWT). */
  registerGuestSocket(socketId: string, username: string): string {
    const userId = `guest-${nanoid()}`;
    this.registerSocket(
      userId,
      socketId,
      { id: userId },
      username.trim() || 'Guest',
    );
    return userId;
  }

  unregisterSocket(socketId: string): string | null {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return null;
    this.socketToUser.delete(socketId);
    const entry = this.userSockets.get(userId);
    if (!entry) return userId;
    entry.socketIds.delete(socketId);
    if (entry.socketIds.size === 0) {
      this.userSockets.delete(userId);
    }
    return userId;
  }

  getOnlineUsers(): OnlineUserInfo[] {
    return Array.from(this.userSockets.values()).map((e) => e.staff);
  }

  getSocketIdsForUser(userId: string): string[] {
    const entry = this.userSockets.get(userId);
    return entry ? Array.from(entry.socketIds) : [];
  }

  registerMessage(
    messageId: string,
    senderId: string,
    recipientId: string,
  ): void {
    this.messageMeta.set(messageId, { senderId, recipientId });
  }

  getMessageMeta(messageId: string): MessageMeta | undefined {
    return this.messageMeta.get(messageId);
  }

  generateMessageId(): string {
    return nanoid();
  }

  /** No-op for now; when persisting, call prisma.chatMessage.create */
  async saveMessage(
    _senderId: string,
    _recipientId: string,
    _content: string,
  ): Promise<void> {
    // Reserved for future DB persistence
  }

  /** No-op for now; when persisting, update message status in DB */
  async markDelivered(_messageId: string): Promise<void> {
    // Reserved for future DB persistence
  }

  /** No-op for now; when persisting, update message status in DB */
  async markRead(_messageId: string): Promise<void> {
    // Reserved for future DB persistence
  }
}
