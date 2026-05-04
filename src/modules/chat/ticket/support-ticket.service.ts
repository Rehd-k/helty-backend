import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupportTicketAuditAction,
  SupportTicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const MAX_TICKET_MESSAGE = 16_000;

@Injectable()
export class SupportTicketService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeContent(raw?: string | null): string | null {
    if (raw == null || raw === '') return null;
    const trimmed = raw
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
    if (trimmed.length > MAX_TICKET_MESSAGE) {
      throw new BadRequestException(
        `Content exceeds ${MAX_TICKET_MESSAGE} characters`,
      );
    }
    return trimmed.length ? trimmed : null;
  }

  async assertTicketAccess(ticketId: string, staffId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        assignments: { select: { staffId: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const assignee = ticket.assignments.some((a) => a.staffId === staffId);
    const creator = ticket.createdById === staffId;
    if (!assignee && !creator) {
      throw new ForbiddenException('No access to this ticket');
    }
    return ticket;
  }

  async create(actorId: string, title: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        title: title.trim(),
        createdById: actorId,
        status: SupportTicketStatus.OPEN,
      },
    });
    await this.audit(ticket.id, actorId, SupportTicketAuditAction.CREATED, {
      title: ticket.title,
    });
    return this.getByIdForStaff(ticket.id, actorId);
  }

  async listForStaff(
    staffId: string,
    filters?: { status?: SupportTicketStatus; assignedToMe?: boolean },
  ) {
    const visibility: Prisma.SupportTicketWhereInput = {
      OR: [{ createdById: staffId }, { assignments: { some: { staffId } } }],
    };
    const where: Prisma.SupportTicketWhereInput = {
      AND: [
        visibility,
        ...(filters?.status ? [{ status: filters.status }] : []),
        ...(filters?.assignedToMe
          ? [{ assignments: { some: { staffId } } }]
          : []),
      ],
    };

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
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
            createdAt: true,
            senderId: true,
          },
        },
      },
    });
    console.log(tickets);
    return tickets;
  }

  async getByIdForStaff(id: string, staffId: string) {
    await this.assertTicketAccess(id, staffId);
    return this.prisma.supportTicket.findUniqueOrThrow({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            staffId: true,
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
          include: {
            staff: {
              select: {
                id: true,
                staffId: true,
                firstName: true,
                lastName: true,
              },
            },
            assignedBy: {
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
          orderBy: { createdAt: 'asc' },
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
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            actor: {
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

  async patchStatus(
    ticketId: string,
    actorId: string,
    status: SupportTicketStatus,
  ) {
    const ticket = await this.assertTicketAccess(ticketId, actorId);
    const prev = ticket.status;
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date() },
    });
    await this.audit(
      ticketId,
      actorId,
      SupportTicketAuditAction.STATUS_CHANGED,
      {
        from: prev,
        to: status,
      },
    );
    return updated;
  }

  async assign(ticketId: string, actorId: string, assignStaffId: string) {
    await this.assertTicketAccess(ticketId, actorId);
    const staff = await this.prisma.staff.findUnique({
      where: { id: assignStaffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    await this.prisma.supportTicketAssignment.upsert({
      where: {
        ticketId_staffId: { ticketId, staffId: assignStaffId },
      },
      create: {
        ticketId,
        staffId: assignStaffId,
        assignedById: actorId,
      },
      update: { assignedById: actorId, assignedAt: new Date() },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    await this.audit(ticketId, actorId, SupportTicketAuditAction.ASSIGNED, {
      assigneeId: assignStaffId,
    });

    return this.getByIdForStaff(ticketId, actorId);
  }

  async unassign(ticketId: string, actorId: string, assignStaffId: string) {
    await this.assertTicketAccess(ticketId, actorId);
    await this.prisma.supportTicketAssignment.deleteMany({
      where: { ticketId, staffId: assignStaffId },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });
    await this.audit(ticketId, actorId, SupportTicketAuditAction.UNASSIGNED, {
      assigneeId: assignStaffId,
    });
    return this.getByIdForStaff(ticketId, actorId);
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    content?: string | null,
    fileUrl?: string | null,
  ) {
    await this.assertTicketAccess(ticketId, senderId);
    const text = this.sanitizeContent(content);
    const file = fileUrl?.trim() || null;
    if (!text && !file) {
      throw new BadRequestException('Message requires content or attachment');
    }

    const msg = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId,
        content: text,
        fileUrl: file,
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

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    await this.audit(
      ticketId,
      senderId,
      SupportTicketAuditAction.MESSAGE_ADDED,
      {
        messageId: msg.id,
      },
    );

    return msg;
  }

  async listMessages(ticketId: string, staffId: string) {
    await this.assertTicketAccess(ticketId, staffId);
    return this.prisma.supportTicketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
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
  }

  private async audit(
    ticketId: string,
    actorId: string,
    action: SupportTicketAuditAction,
    payload?: Prisma.InputJsonValue,
  ) {
    await this.prisma.supportTicketAuditLog.create({
      data: {
        ticketId,
        actorId,
        action,
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  }

  participantStaffIds(ticket: {
    createdById: string;
    assignments: { staffId: string }[];
  }): string[] {
    const ids = new Set<string>();
    ids.add(ticket.createdById);
    for (const a of ticket.assignments) ids.add(a.staffId);
    return [...ids];
  }
}
