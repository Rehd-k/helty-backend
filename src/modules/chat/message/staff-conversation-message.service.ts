import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StaffConversationMessageType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StaffConversationService } from '../conversation/staff-conversation.service';
import { PresenceService } from '../presence/presence.service';

const MAX_CONTENT_LENGTH = 16_000;

export interface SendConversationMessageInput {
  content?: string | null;
  type?: StaffConversationMessageType;
  fileUrl?: string | null;
}

@Injectable()
export class StaffConversationMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: StaffConversationService,
    private readonly presence: PresenceService,
  ) {}

  private sanitizeContent(raw?: string | null): string | null {
    if (raw == null || raw === '') return null;
    const trimmed = raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
    if (trimmed.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException(
        `Content exceeds ${MAX_CONTENT_LENGTH} characters`,
      );
    }
    return trimmed.length ? trimmed : null;
  }

  async listMessages(
    conversationId: string,
    staffId: string,
    limit: number,
    cursor?: string,
  ) {
    await this.conversations.assertMember(conversationId, staffId);
    const take = Math.min(Math.max(limit || 30, 1), 100);

    const where: Prisma.StaffConversationMessageWhereInput = {
      conversationId,
    };

    if (cursor) {
      const anchor = await this.prisma.staffConversationMessage.findFirst({
        where: { id: cursor, conversationId },
      });
      if (anchor) {
        where.OR = [
          { createdAt: { lt: anchor.createdAt } },
          {
            AND: [{ createdAt: anchor.createdAt }, { id: { lt: anchor.id } }],
          },
        ];
      }
    }

    const rows = await this.prisma.staffConversationMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: {
        sender: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        reads: {
          where: { staffId },
          select: { id: true },
        },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

    return {
      items: page.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: m.sender,
        content: m.content,
        type: m.type,
        fileUrl: m.fileUrl,
        createdAt: m.createdAt,
        readByMe: m.reads.length > 0,
      })),
      nextCursor,
    };
  }

  async send(
    conversationId: string,
    senderId: string,
    input: SendConversationMessageInput,
  ) {
    await this.conversations.assertMember(conversationId, senderId);

    const type = input.type ?? StaffConversationMessageType.TEXT;
    const content = this.sanitizeContent(input.content);
    const fileUrl = input.fileUrl?.trim() || null;

    if (type === StaffConversationMessageType.TEXT && !content) {
      throw new BadRequestException('Text messages require content');
    }
    if (type !== StaffConversationMessageType.TEXT && !fileUrl && !content) {
      throw new BadRequestException('File messages require fileUrl or caption');
    }

    const msg = await this.prisma.staffConversationMessage.create({
      data: {
        conversationId,
        senderId,
        content,
        type,
        fileUrl,
      },
      include: {
        sender: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.conversations.touchConversationUpdatedAt(conversationId);

    const memberIds = await this.conversations.memberStaffIds(conversationId);
    const recipients = memberIds.filter((id) => id !== senderId);
    if (recipients.length) {
      await this.presence.incrementUnread(recipients, conversationId);
    }

    return msg;
  }

  async markReadUpTo(
    conversationId: string,
    readerId: string,
    lastReadMessageId: string,
  ) {
    await this.conversations.assertMember(conversationId, readerId);

    const anchor = await this.prisma.staffConversationMessage.findFirst({
      where: { id: lastReadMessageId, conversationId },
    });
    if (!anchor) {
      throw new BadRequestException('Message not in this conversation');
    }

    const targets = await this.prisma.staffConversationMessage.findMany({
      where: {
        conversationId,
        senderId: { not: readerId },
        createdAt: { lte: anchor.createdAt },
      },
      select: { id: true },
    });

    if (targets.length) {
      await this.prisma.staffConversationMessageRead.createMany({
        data: targets.map((t) => ({
          messageId: t.id,
          staffId: readerId,
        })),
        skipDuplicates: true,
      });
    }

    await this.presence.clearUnread(readerId, conversationId);

    return {
      markedCount: targets.length,
      lastReadMessageId,
    };
  }
}
