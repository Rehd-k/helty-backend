import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { CreateLabAstResultBatchDto } from './dto/create-lab-ast-result-batch.dto';

const astResultInclude = {
  antibiotic: true,
  resultOption: true,
  enteredBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class LabAstResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  private async assertOrderItemAllowsAst(orderItemId: string) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
      select: {
        astRequested: true,
        order: { select: { invoiceItemId: true, patientId: true } },
      },
    });
    if (!orderItem) {
      throw new NotFoundException(`Lab order item "${orderItemId}" not found.`);
    }
    if (!orderItem.astRequested) {
      throw new BadRequestException(
        `Order item "${orderItemId}" was not flagged for AST at order time.`,
      );
    }
    return orderItem;
  }

  private async validateCatalogRows(
    antibioticIds: string[],
    resultOptionIds: string[],
  ) {
    const antibiotics = await this.prisma.labAntibiotic.findMany({
      where: { id: { in: antibioticIds }, isActive: true },
    });
    if (antibiotics.length !== antibioticIds.length) {
      throw new BadRequestException(
        'One or more antibiotics are invalid or inactive.',
      );
    }

    const options = await this.prisma.labAstResultOption.findMany({
      where: { id: { in: resultOptionIds }, isActive: true },
    });
    if (options.length !== resultOptionIds.length) {
      throw new BadRequestException(
        'One or more AST result options are invalid or inactive.',
      );
    }
  }

  async createBatch(dto: CreateLabAstResultBatchDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.enteredBy },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${dto.enteredBy}" not found.`);
    }

    const antibioticIds = dto.results.map((r) => r.antibioticId);
    if (new Set(antibioticIds).size !== antibioticIds.length) {
      throw new BadRequestException(
        'Duplicate antibiotic entries in the same batch are not allowed.',
      );
    }

    const orderItem = await this.assertOrderItemAllowsAst(dto.orderItemId);
    await this.validateCatalogRows(
      antibioticIds,
      dto.results.map((r) => r.resultOptionId),
    );

    return this.prisma.$transaction(async (tx) => {
      const invoiceItemId = orderItem.order.invoiceItemId;
      if (invoiceItemId && orderItem.order.patientId) {
        await this.invoiceService.assertInvoiceItemPaidOrInpatientCredit(tx, {
          invoiceItemId,
          patientId: orderItem.order.patientId,
        });
      }
      await this.invoiceService.settleInvoiceItemIfPresent(tx, invoiceItemId);

      return Promise.all(
        dto.results.map((r) =>
          tx.labAstResult.upsert({
            where: {
              orderItemId_antibioticId: {
                orderItemId: dto.orderItemId,
                antibioticId: r.antibioticId,
              },
            },
            create: {
              orderItemId: dto.orderItemId,
              antibioticId: r.antibioticId,
              resultOptionId: r.resultOptionId,
              enteredById: dto.enteredBy,
            },
            update: {
              resultOptionId: r.resultOptionId,
              enteredById: dto.enteredBy,
            },
            include: astResultInclude,
          }),
        ),
      );
    });
  }

  async findAllByOrderItemId(orderItemId: string) {
    const orderItem = await this.prisma.labOrderItem.findUnique({
      where: { id: orderItemId },
      select: { id: true, astRequested: true },
    });
    if (!orderItem) {
      throw new NotFoundException(`Lab order item "${orderItemId}" not found.`);
    }

    const results = await this.prisma.labAstResult.findMany({
      where: { orderItemId },
      include: astResultInclude,
      orderBy: [
        { antibiotic: { position: 'asc' } },
        { antibiotic: { name: 'asc' } },
      ],
    });

    return {
      orderItemId,
      astRequested: orderItem.astRequested,
      results,
    };
  }
}
