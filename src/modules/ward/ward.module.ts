import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WardService } from './ward.service';
import { WardController } from './ward.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WardController],
  providers: [WardService],
  exports: [WardService],
})
export class WardModule {}
