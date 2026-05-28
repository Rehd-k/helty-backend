import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CmacAnalyticsModule } from '../cmac-analytics/cmac-analytics.module';
import { CmdAnalyticsController } from './cmd-analytics.controller';
import { CmdAnalyticsService } from './cmd-analytics.service';

@Module({
  imports: [PrismaModule, CmacAnalyticsModule],
  controllers: [CmdAnalyticsController],
  providers: [CmdAnalyticsService],
})
export class CmdAnalyticsModule {}
