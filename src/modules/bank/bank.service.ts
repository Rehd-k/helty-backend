import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankDto, UpdateBankDto, QueryBankDto } from './dto/bank.dto';

@Injectable()
export class BankService {
    private readonly logger = new Logger(BankService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─── Create ──────────────────────────────────────────────────────────────────

    async create(dto: CreateBankDto) {
        const existing = await this.prisma.bank.findUnique({
            where: { accountNumber: dto.accountNumber },
        });
        if (existing) {
            throw new ConflictException(
                `A bank with account number "${dto.accountNumber}" already exists.`,
            );
        }

        const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
        if (!staff) throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

        const bank = await this.prisma.bank.create({
            data: {
                name: dto.name,
                accountNumber: dto.accountNumber,
                createdById: dto.staffId,
                updatedById: dto.staffId,
            },
        });

        this.logger.log(`Bank "${bank.name}" (${bank.accountNumber}) created — id: ${bank.id}`);
        return bank;
    }

    // ─── Find All ─────────────────────────────────────────────────────────────────

    async findAll(query: QueryBankDto) {
        const { search, skip = 0, take = 20 } = query;

        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { accountNumber: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {};

        const [data, total] = await Promise.all([
            this.prisma.bank.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    updatedBy: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { transactionPayments: true } },
                },
            }),
            this.prisma.bank.count({ where }),
        ]);

        return { data, total, skip, take };
    }

    // ─── Find One ─────────────────────────────────────────────────────────────────

    async findOne(id: string) {
        const bank = await this.prisma.bank.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { transactionPayments: true } },
            },
        });
        if (!bank) throw new NotFoundException(`Bank "${id}" not found.`);
        return bank;
    }

    // ─── Find by Account Number (used internally by billing) ─────────────────────

    async findByAccountNumber(accountNumber: string) {
        const bank = await this.prisma.bank.findUnique({ where: { accountNumber } });
        if (!bank) {
            throw new NotFoundException(
                `No bank found with account number "${accountNumber}". ` +
                `Register the bank first at POST /bank.`,
            );
        }
        return bank;
    }

    // ─── Update ───────────────────────────────────────────────────────────────────

    async update(id: string, dto: UpdateBankDto) {
        await this.findOne(id); // throws 404 if not found

        const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
        if (!staff) throw new NotFoundException(`Staff "${dto.staffId}" not found.`);

        if (dto.accountNumber) {
            const conflict = await this.prisma.bank.findFirst({
                where: { accountNumber: dto.accountNumber, NOT: { id } },
            });
            if (conflict) {
                throw new ConflictException(
                    `Account number "${dto.accountNumber}" is already in use by another bank.`,
                );
            }
        }

        const updated = await this.prisma.bank.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.accountNumber && { accountNumber: dto.accountNumber }),
                updatedById: dto.staffId,
            },
        });

        this.logger.log(`Bank "${updated.id}" updated.`);
        return updated;
    }

    // ─── Delete ───────────────────────────────────────────────────────────────────

    async remove(id: string) {
        await this.findOne(id); // throws 404 if not found

        const paymentCount = await this.prisma.transactionPayment.count({
            where: { bankId: id },
        });
        if (paymentCount > 0) {
            throw new BadRequestException(
                `Cannot delete bank "${id}" — it has ${paymentCount} payment(s) linked to it. ` +
                `Reassign or void those payments first.`,
            );
        }

        await this.prisma.bank.delete({ where: { id } });
        this.logger.log(`Bank "${id}" deleted.`);
        return { message: 'Bank deleted successfully.' };
    }
}
