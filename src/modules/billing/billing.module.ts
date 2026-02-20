import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';

@Module({
    imports: [PrismaModule, StaffModule],
    controllers: [BillingController],
    providers: [BillingService],
    exports: [BillingService],
})
export class BillingModule { }
