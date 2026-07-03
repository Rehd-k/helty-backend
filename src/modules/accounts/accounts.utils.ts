import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FiscalPeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export function toNumber(
  d: Prisma.Decimal | number | null | undefined,
): number {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  return d.toNumber();
}

export function isAccountHead(staffRole?: string): boolean {
  return staffRole === 'ACCOUNT_HEAD' || staffRole === 'SUPER_ADMIN';
}

export function isRefundReviewer(staffRole?: string): boolean {
  return isAccountHead(staffRole) || staffRole === 'BILLING_HEAD';
}

export function assertAccountHead(staffRole?: string): void {
  if (!isAccountHead(staffRole)) {
    throw new ForbiddenException(
      'Only account head staff can perform this action.',
    );
  }
}

export function assertRefundReviewer(staffRole?: string): void {
  if (!isRefundReviewer(staffRole)) {
    throw new ForbiddenException(
      'Only account head or billing head staff can perform this action.',
    );
  }
}

export function staffLabel(staff?: {
  email?: string | null;
  staffId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
} | null): string {
  if (!staff) return 'system';
  const name = [staff.firstName, staff.lastName].filter(Boolean).join(' ');
  return name || staff.email || staff.staffId || 'unknown';
}

export async function assertPeriodOpen(
  prisma: PrismaService,
  date: Date,
): Promise<void> {
  const closed = await prisma.fiscalPeriod.findFirst({
    where: {
      status: FiscalPeriodStatus.closed,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
  if (closed) {
    throw new ConflictException(
      `Fiscal period "${closed.label}" is closed; backdated postings are blocked.`,
    );
  }
}

export function ageDays(from: Date, asOf: Date): number {
  const ms = asOf.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function agingBucket(days: number): string {
  if (days <= 0) return 'Current';
  if (days <= 30) return '1-30 days';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return '90+ days';
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
