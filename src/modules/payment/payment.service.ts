import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto) {
    return this.prisma.payment.create({
      data: {
        patientId: createPaymentDto.patientId,
        amount: createPaymentDto.amount,
        method: createPaymentDto.method,
        description: createPaymentDto.description,
      },
    });
  }

  async findAll(skip = 0, take = 10) {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take,
        include: {
          patient: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.payment.count(),
    ]);

    return { payments, total, skip, take };
  }

  async findOne(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });
  }

  async findByPatientId(patientId: string) {
    return this.prisma.payment.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      },
    });
  }

  async getTotalPaymentsByPatient(patientId: string) {
    const result = await this.prisma.payment.aggregate({
      where: { patientId },
      _sum: { amount: true },
      _count: true,
    });

    return {
      totalAmount: result._sum.amount || 0,
      paymentCount: result._count,
      patientId,
    };
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    return this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
    });
  }

  async remove(id: string) {
    return this.prisma.payment.delete({
      where: { id },
    });
  }
}
