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
    console.log("data", data);
    

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
      include: { department: true, headedDepartment: true },
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

  async update(id: string, data: Partial<any>) {
    return this.prisma.staff.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.staff.delete({ where: { id } });
  }
}
