/**
 * Message status for delivery receipts (one tick = delivered, two ticks = read).
 * Matches Prisma ChatMessageStatus enum for future DB persistence.
 */
export type ChatMessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface OnlineUserInfo {
  id: string;
  displayName: string;
  /** Present for staff (JWT auth); empty for guest (username-only test mode) */
  staffId?: string;
  firstName?: string;
  lastName?: string;
}

export interface ChatMessagePayload {
  messageId: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: ChatMessageStatus;
  createdAt: string; // ISO string
}
