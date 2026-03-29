import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingAnalyticsController } from './billing-analytics.controller';
import { BillingAnalyticsService } from './billing-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingAnalyticsController],
  providers: [BillingAnalyticsService],
  exports: [BillingAnalyticsService],
})
export class BillingAnalyticsModule {}
