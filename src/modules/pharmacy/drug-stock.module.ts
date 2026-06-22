import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DrugStockService } from './drug-stock.service';

@Module({
  imports: [PrismaModule],
  providers: [DrugStockService],
  exports: [DrugStockService],
})
export class DrugStockModule {}
