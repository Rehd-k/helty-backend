import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { OnlineUserInfo } from './chat.types';
import { PresenceService } from './presence/presence.service';

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

  /** Legacy ephemeral message id routing (1:1 demo chat) */
  private readonly messageMeta = new Map<string, MessageMeta>();

  constructor(private readonly presence: PresenceService) {}

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
    const wasEmpty = !existing || existing.socketIds.size === 0;
    if (existing) {
      existing.socketIds.add(socketId);
    } else {
      this.userSockets.set(userId, {
        socketIds: new Set([socketId]),
        staff: staffInfo,
      });
    }
    if (wasEmpty) {
      void this.presence.setOnline(userId);
    }
  }

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
      if (!userId.startsWith('guest-')) {
        void this.presence.setAway(userId);
      }
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

  async saveMessage(
    _senderId: string,
    _recipientId: string,
    _content: string,
  ): Promise<void> {
    // Legacy path; persisted chat uses StaffConversationMessage
  }

  async markDelivered(_messageId: string): Promise<void> {}

  async markRead(_messageId: string): Promise<void> {}
}
