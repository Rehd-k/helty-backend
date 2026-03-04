import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PharmacyDrugController } from './pharmacy.drug.controller';
import { PharmacyDrugService } from './pharmacy.drug.service';
import { PharmacyBatchController } from './pharmacy.batch.controller';
import { PharmacyBatchService } from './pharmacy.batch.service';

@Module({
  imports: [PrismaModule],
  controllers: [PharmacyDrugController, PharmacyBatchController],
  providers: [PharmacyDrugService, PharmacyBatchService],
  exports: [PharmacyDrugService, PharmacyBatchService],
})
export class PharmacyModule {}

