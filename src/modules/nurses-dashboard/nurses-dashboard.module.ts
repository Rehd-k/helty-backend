import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NursesDashboardController } from './nurses-dashboard.controller';
import { NursesDashboardService } from './nurses-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [NursesDashboardController],
  providers: [NursesDashboardService],
  exports: [NursesDashboardService],
})
export class NursesDashboardModule {}
