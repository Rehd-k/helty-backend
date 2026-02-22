import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { TransactionController } from './billing.controller';
import { TransactionService } from './billing.service';

@Module({
    imports: [PrismaModule, StaffModule],
    controllers: [TransactionController],
    providers: [TransactionService],
    exports: [TransactionService],
})
export class TransactionModule { }
