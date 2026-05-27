import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QualitySafetyController } from './quality-safety.controller';
import { QualitySafetyService } from './quality-safety.service';

@Module({
  imports: [PrismaModule],
  controllers: [QualitySafetyController],
  providers: [QualitySafetyService],
  exports: [QualitySafetyService],
})
export class QualitySafetyModule {}
