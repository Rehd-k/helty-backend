import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { TransactionController } from './billing.controller';
import { TransactionService } from './billing.service';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
