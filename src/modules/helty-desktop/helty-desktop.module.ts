import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HeltyDesktopController } from './helty-desktop.controller';
import { HeltyDesktopService } from './helty-desktop.service';

@Module({
  imports: [PrismaModule],
  controllers: [HeltyDesktopController],
  providers: [HeltyDesktopService],
  exports: [HeltyDesktopService],
})
export class HeltyDesktopModule {}
