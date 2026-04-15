import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  StaffConversationMemberRole,
  StaffConversationType,
  StaffRole,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

function directKeyForPair(a: string, b: string): string {
  return [a, b].sort().join(':');
}

@Injectable()
export class StaffConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  async assertMember(conversationId: string, staffId: string) {
    const m = await this.prisma.staffConversationMember.findUnique({
      where: {
        conversationId_staffId: { conversationId, staffId },
      },
    });
    if (!m) throw new ForbiddenException('Not a member of this conversation');
    return m;
  }

  async isSuperAdmin(staffId: string): Promise<boolean> {
    const s = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { accountType: true, staffRole: true },
    });
    if (!s) return false;
    return (
      s.accountType === AccountType.SUPER_ADMIN ||
      s.staffRole === StaffRole.SUPER_ADMIN
    );
  }

  async assertAdmin(conversationId: string, staffId: string) {
    const m = await this.assertMember(conversationId, staffId);
    if (m.role !== StaffConversationMemberRole.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }
    return m;
  }

  async assertAdminOrSuper(conversationId: string, staffId: string) {
    const m = await this.assertMember(conversationId, staffId);
    if (m.role === StaffConversationMemberRole.ADMIN) return m;
    if (await this.isSuperAdmin(staffId)) return m;
    throw new ForbiddenException('Admin role required');
  }

  async listForStaff(staffId: string) {
    const memberships = await this.prisma.staffConversationMember.findMany({
      where: { staffId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                staff: {
                  select: {
                    id: true,
                    staffId: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                content: true,
                type: true,
                createdAt: true,
                senderId: true,
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const convIds = memberships.map((x) => x.conversationId);
    const unreadMap = await this.presence.getManyUnread(staffId, convIds);

    return memberships.map((mem) => ({
      ...mem.conversation,
      myRole: mem.role,
      unreadCount: unreadMap.get(mem.conversationId) ?? 0,
      lastMessage: mem.conversation.messages[0] ?? null,
      members: mem.conversation.members.map((m) => ({
        id: m.id,
        role: m.role,
        staff: m.staff,
      })),
      messages: undefined,
    }));
  }

  async getOrCreateDirect(staffId: string, otherStaffId: string) {
    if (staffId === otherStaffId) {
      throw new BadRequestException('Cannot start a direct chat with yourself');
    }
    const other = await this.prisma.staff.findUnique({
      where: { id: otherStaffId },
    });
    if (!other) throw new NotFoundException('Other staff not found');

    const directKey = directKeyForPair(staffId, otherStaffId);
    const existing = await this.prisma.staffConversation.findUnique({
      where: { directKey },
      include: {
        members: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (existing) return existing;

    return this.prisma.staffConversation.create({
      data: {
        type: StaffConversationType.DIRECT,
        directKey,
        members: {
          create: [
            { staffId, role: StaffConversationMemberRole.MEMBER },
            {
              staffId: otherStaffId,
              role: StaffConversationMemberRole.MEMBER,
            },
          ],
        },
      },
      include: {
        members: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async createGroup(
    creatorId: string,
    name: string,
    memberStaffIds: string[],
  ) {
    const unique = [...new Set([creatorId, ...memberStaffIds])];
    const count = await this.prisma.staff.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more staff ids are invalid');
    }

    return this.prisma.staffConversation.create({
      data: {
        type: StaffConversationType.GROUP,
        name: name.trim(),
        members: {
          create: unique.map((id) => ({
            staffId: id,
            role:
              id === creatorId
                ? StaffConversationMemberRole.ADMIN
                : StaffConversationMemberRole.MEMBER,
          })),
        },
      },
      include: {
        members: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async addMember(
    conversationId: string,
    actorId: string,
    newStaffId: string,
  ) {
    const conv = await this.prisma.staffConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== StaffConversationType.GROUP) {
      throw new BadRequestException('Only group conversations support add member');
    }
    await this.assertAdminOrSuper(conversationId, actorId);

    const exists = await this.prisma.staff.findUnique({
      where: { id: newStaffId },
    });
    if (!exists) throw new NotFoundException('Staff not found');

    await this.prisma.staffConversationMember.upsert({
      where: {
        conversationId_staffId: {
          conversationId,
          staffId: newStaffId,
        },
      },
      create: {
        conversationId,
        staffId: newStaffId,
        role: StaffConversationMemberRole.MEMBER,
      },
      update: {},
    });

    await this.prisma.staffConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return this.getOne(conversationId, actorId);
  }

  async removeMember(
    conversationId: string,
    actorId: string,
    targetStaffId: string,
  ) {
    const conv = await this.prisma.staffConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== StaffConversationType.GROUP) {
      throw new BadRequestException(
        'Only group conversations support remove member',
      );
    }
    await this.assertAdminOrSuper(conversationId, actorId);
    if (targetStaffId === actorId) {
      throw new BadRequestException('Use leave endpoint to remove yourself');
    }

    await this.prisma.staffConversationMember.delete({
      where: {
        conversationId_staffId: {
          conversationId,
          staffId: targetStaffId,
        },
      },
    });

    await this.prisma.staffConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return { ok: true };
  }

  async promoteAdmin(
    conversationId: string,
    actorId: string,
    targetStaffId: string,
  ) {
    const conv = await this.prisma.staffConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== StaffConversationType.GROUP) {
      throw new BadRequestException('Only group conversations support promote');
    }
    await this.assertAdminOrSuper(conversationId, actorId);

    await this.prisma.staffConversationMember.update({
      where: {
        conversationId_staffId: {
          conversationId,
          staffId: targetStaffId,
        },
      },
      data: { role: StaffConversationMemberRole.ADMIN },
    });

    return this.getOne(conversationId, actorId);
  }

  async renameGroup(
    conversationId: string,
    actorId: string,
    name: string,
  ) {
    const conv = await this.prisma.staffConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== StaffConversationType.GROUP) {
      throw new BadRequestException('Only group conversations can be renamed');
    }
    await this.assertAdminOrSuper(conversationId, actorId);

    return this.prisma.staffConversation.update({
      where: { id: conversationId },
      data: { name: name.trim(), updatedAt: new Date() },
      include: {
        members: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async getOne(conversationId: string, staffId: string) {
    await this.assertMember(conversationId, staffId);
    return this.prisma.staffConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async memberStaffIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.staffConversationMember.findMany({
      where: { conversationId },
      select: { staffId: true },
    });
    return rows.map((r) => r.staffId);
  }

  async touchConversationUpdatedAt(conversationId: string) {
    await this.prisma.staffConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
