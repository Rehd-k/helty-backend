import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FrontdeskController } from './frontdesk.controller';
import { FrontdeskService } from './frontdesk.service';

@Module({
  imports: [PrismaModule],
  controllers: [FrontdeskController],
  providers: [FrontdeskService],
  exports: [FrontdeskService],
})
export class FrontdeskModule {}
