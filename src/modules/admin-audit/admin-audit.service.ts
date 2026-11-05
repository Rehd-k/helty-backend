import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';

const LAGOS_OFFSET = '+01:00';
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;

const staffSelect = {
  id: true,
  staffId: true,
  firstName: true,
  lastName: true,
  staffRole: true,
  accountType: true,
} satisfies Prisma.StaffSelect;

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AdminAuditQueryDto) {
    const from = q.from
      ? parseFrom(q.from)
      : new Date(Date.now() - DEFAULT_RANGE_MS);
    const to = q.to ? parseTo(q.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be before to');
    }

    const limit = q.limit ?? DEFAULT_LIMIT;
    const where = this.buildWhere(q, from, to);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { performedBy: { select: staffSelect } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        summary: row.summary,
        route: row.route,
        httpMethod: row.httpMethod,
        ipAddress: row.ipAddress,
        staffRole: row.staffRole,
        accountType: row.accountType,
        departmentName: row.departmentName,
        oldValue: row.oldValue,
        newValue: row.newValue,
        staff: row.performedBy
          ? {
              id: row.performedBy.id,
              staffId: row.performedBy.staffId,
              firstName: row.performedBy.firstName,
              lastName: row.performedBy.lastName,
              staffRole: row.performedBy.staffRole,
              accountType: row.performedBy.accountType,
            }
          : null,
      })),
      nextCursor:
        hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  private buildWhere(
    q: AdminAuditQueryDto,
    from: Date,
    to: Date,
  ): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [
      { createdAt: { gte: from, lte: to } },
    ];
    if (q.performedById) and.push({ performedById: q.performedById });
    if (q.action?.trim()) and.push({ action: q.action.trim() });
    if (q.entity?.trim()) {
      and.push({
        entity: { contains: q.entity.trim(), mode: 'insensitive' },
      });
    }
    const search = q.q?.trim();
    if (search) {
      and.push({
        OR: [
          { summary: { contains: search, mode: 'insensitive' } },
          { entity: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
          {
            performedBy: {
              is: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { staffId: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }
    const cursor = parseCursor(q.cursor);
    if (q.cursor && !cursor) {
      throw new BadRequestException('Invalid cursor');
    }
    if (cursor) {
      and.push({
        OR: [
          { createdAt: { lt: cursor.at } },
          { createdAt: cursor.at, id: { lt: cursor.id } },
        ],
      });
    }
    return { AND: and };
  }
}

function parseFrom(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000${LAGOS_OFFSET}`);
  }
  return new Date(value);
}

function parseTo(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999${LAGOS_OFFSET}`);
  }
  return new Date(value);
}

function parseCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  const splitAt = cursor.lastIndexOf('|');
  if (splitAt <= 0) return null;
  const at = new Date(cursor.slice(0, splitAt));
  const id = cursor.slice(splitAt + 1);
  if (!id || Number.isNaN(at.getTime())) return null;
  return { at, id };
}
