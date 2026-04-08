import { Module } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { EncounterController } from './encounter.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [EncounterController],
  providers: [EncounterService],
  exports: [EncounterService],
})
export class EncounterModule {}
