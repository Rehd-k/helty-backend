import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.StaffCreateInput) {
    // hash password if provided
    if ('password' in data && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    if ('role' in data) {
      delete data.role;
    }

    // cast to any because of relation union types
    const newStaff = await this.prisma.staff.create({ data: data as any });

    return newStaff;
  }

  async findAll() {
    const staffs = await this.prisma.staff.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return staffs;
  }

  async findById(id: string) {
    const user = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        headedDepartment: true,
        passwordResets: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, code: true, expiresAt: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async findByEmail(email: string) {
    if (!email) return null;
    return this.prisma.staff.findUnique({
      where: { email },
      include: { department: true, headedDepartment: true },
    });
  }

  /** Active staff with non-null email (case-insensitive), for password reset. */
  async findActiveByEmailForPasswordReset(email: string) {
    const trimmed = email?.trim() ?? '';
    if (!trimmed || !trimmed.includes('@')) return null;
    return this.prisma.staff.findFirst({
      where: {
        email: { equals: trimmed, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, email: true },
    });
  }

  private staffAuthInclude = {
    department: true,
    headedDepartment: true,
  } as const;

  /**
   * Resolve staff for login: if the value contains `@`, match email (case-insensitive);
   * otherwise treat as phone and match after stripping non-digits from both sides.
   */
  async findByEmailOrPhone(identifier: string) {
    const trimmed = identifier?.trim() ?? '';
    if (!trimmed) return null;

    if (trimmed.includes('@')) {
      return this.prisma.staff.findFirst({
        where: {
          email: { equals: trimmed, mode: 'insensitive' },
        },
        include: this.staffAuthInclude,
      });
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits || digits.length < 5) return null;

    const matches = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT "id" FROM "Staff"
        WHERE "phone" IS NOT NULL
          AND regexp_replace("phone", '[^0-9]', '', 'g') = ${digits}
        LIMIT 2
      `,
    );

    if (matches.length !== 1) return null;

    return this.prisma.staff.findUnique({
      where: { id: matches[0].id },
      include: this.staffAuthInclude,
    });
  }

  async update(id: string, data: Partial<any>) {
    return this.prisma.staff.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.staff.delete({ where: { id } });
  }
}
