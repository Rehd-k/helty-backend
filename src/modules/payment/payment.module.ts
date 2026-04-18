import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { InvoicePaymentsController } from './invoice-payments.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [PaymentController, InvoicePaymentsController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
