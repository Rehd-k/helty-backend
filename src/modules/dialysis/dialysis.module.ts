import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { StoreModule } from '../store/store.module';
import { DialysisSessionController } from './dialysis-session.controller';
import { DialysisSessionService } from './dialysis-session.service';

@Module({
  imports: [PrismaModule, InvoiceModule, StoreModule],
  controllers: [DialysisSessionController],
  providers: [DialysisSessionService],
  exports: [DialysisSessionService],
})
export class DialysisModule {}
