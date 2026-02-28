import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNoIdPatientDto, UpdateNoIdPatientDto } from './dto/no-id-patient.dto';

@Injectable()
export class NoIdPatientService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── CRUD ──────────────────────────────────────────────────────────────────

    async create(dto: CreateNoIdPatientDto) {
        return this.prisma.noIdPatient.create({
            data: {
                firstName: dto.firstName,
                lastname: dto.lastname,
                age: dto.age,
                gender: dto.gender,
            },
        });
    }

    async findAll(skip = 0, take = 20) {
        const [patients, total] = await Promise.all([
            this.prisma.noIdPatient.findMany({
                skip,
                take,
                orderBy: { id: 'asc' },
                include: {
                    _count: { select: { services: true, transactions: true } },
                },
            }),
            this.prisma.noIdPatient.count(),
        ]);
        return { patients, total, skip, take };
    }

    async findOne(id: string) {
        const patient = await this.prisma.noIdPatient.findUnique({
            where: { id },
            include: {
                services: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        cost: true,
                        categoryId: true,
                        departmentId: true,
                    },
                },
                transactions: {
                    select: {
                        id: true,
                        transactionNumber: true,
                        status: true,
                        totalAmount: true,
                        amountPaid: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!patient) throw new NotFoundException(`NoIdPatient ${id} not found`);
        return patient;
    }

    async update(id: string, dto: UpdateNoIdPatientDto) {
        await this.findOne(id); // throws 404 if not found
        return this.prisma.noIdPatient.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        const patient = await this.findOne(id);
        const hasLinked =
            patient.services.length > 0 || patient.transactions.length > 0;

        if (hasLinked) {
            throw new BadRequestException(
                'Cannot delete a NoIdPatient that still has linked services or transactions. ' +
                'Use the merge endpoint to transfer them to a registered Patient first.',
            );
        }

        await this.prisma.noIdPatient.delete({ where: { id } });
        return { message: `NoIdPatient ${id} deleted successfully` };
    }

    // ─── Services Sub-resource ─────────────────────────────────────────────────

    async getServices(noIdPatientId: string) {
        await this.findOne(noIdPatientId); // ensure exists
        return this.prisma.service.findMany({
            where: { noIdPatientId },
            select: {
                id: true,
                name: true,
                description: true,
                cost: true,
                categoryId: true,
                departmentId: true,
                createdAt: true,
            },
        });
    }

    async addService(noIdPatientId: string, serviceId: string) {
        await this.findOne(noIdPatientId); // ensure NoIdPatient exists

        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new NotFoundException(`Service ${serviceId} not found`);

        if (service.noIdPatientId === noIdPatientId) {
            throw new BadRequestException('Service is already linked to this NoIdPatient');
        }

        return this.prisma.service.update({
            where: { id: serviceId },
            data: { noIdPatientId },
        });
    }

    async removeService(noIdPatientId: string, serviceId: string) {
        await this.findOne(noIdPatientId);

        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new NotFoundException(`Service ${serviceId} not found`);

        if (service.noIdPatientId !== noIdPatientId) {
            throw new BadRequestException('Service is not linked to this NoIdPatient');
        }

        return this.prisma.service.update({
            where: { id: serviceId },
            data: { noIdPatientId: null },
        });
    }

    // ─── Merge / Transfer ──────────────────────────────────────────────────────

    /**
     * Transfer all Transactions from a NoIdPatient to a registered Patient,
     * detach all linked Services from the NoIdPatient, then delete the NoIdPatient row.
     *
     * Note: Service has no direct Patient relation in the schema, so services are
     * detached (noIdPatientId cleared). Transactions are fully reassigned to patientId.
     */
    async mergeIntoPatient(noIdPatientId: string, patientId: string) {
        // 1. Verify both records exist
        const noIdPatient = await this.prisma.noIdPatient.findUnique({
            where: { id: noIdPatientId },
            include: {
                _count: { select: { services: true, transactions: true } },
            },
        });
        if (!noIdPatient) {
            throw new NotFoundException(`NoIdPatient ${noIdPatientId} not found`);
        }

        const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            throw new NotFoundException(`Patient ${patientId} not found`);
        }

        const serviceCount = noIdPatient._count.services;
        const transactionCount = noIdPatient._count.transactions;

        // 2. Run all mutations in a single atomic transaction
        await this.prisma.$transaction([
            // Detach all services from this NoIdPatient
            this.prisma.service.updateMany({
                where: { noIdPatientId },
                data: { noIdPatientId: null },
            }),
            // Reassign all transactions to the registered Patient
            this.prisma.transaction.updateMany({
                where: { noIdPatientid: noIdPatientId },
                data: { noIdPatientid: null, patientId },
            }),
            // Delete the NoIdPatient row
            this.prisma.noIdPatient.delete({ where: { id: noIdPatientId } }),
        ]);

        return {
            message: 'Merge completed successfully',
            migratedTransactions: transactionCount,
            detachedServices: serviceCount,
            noIdPatientId,
            patientId,
        };
    }
}
