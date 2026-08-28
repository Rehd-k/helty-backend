import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SystemAnnouncementsController } from './system-announcements.controller';
import { SystemAnnouncementsService } from './system-announcements.service';

@Module({
  imports: [PrismaModule],
  controllers: [SystemAnnouncementsController],
  providers: [SystemAnnouncementsService],
  exports: [SystemAnnouncementsService],
})
export class SystemAnnouncementsModule {}
