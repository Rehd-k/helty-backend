import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HospitalAssetsController } from './hospital-assets.controller';
import { HospitalAssetsService } from './hospital-assets.service';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalAssetsController],
  providers: [HospitalAssetsService],
  exports: [HospitalAssetsService],
})
export class HospitalAssetsModule {}
