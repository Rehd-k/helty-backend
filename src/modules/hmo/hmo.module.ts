import { Module } from '@nestjs/common';
import { HmoService } from './hmo.service';
import { HmoController } from './hmo.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HmoController],
  providers: [HmoService],
  exports: [HmoService],
})
export class HmoModule {}
