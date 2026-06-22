import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTheatreRoomDto,
  UpdateTheatreRoomDto,
} from './dto/theatre.dto';

@Injectable()
export class TheatreRoomService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.theatreRoom.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateTheatreRoomDto) {
    return this.prisma.theatreRoom.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTheatreRoomDto) {
    const room = await this.prisma.theatreRoom.findUnique({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Theatre room "${id}" not found.`);
    }
    return this.prisma.theatreRoom.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
      },
    });
  }
}
