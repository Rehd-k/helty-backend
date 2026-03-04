import { Module } from '@nestjs/common';
import { LabRequestService } from './lab-request.service';
import { LabRequestController } from './lab-request.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LabRequestController],
  providers: [LabRequestService],
  exports: [LabRequestService],
})
export class LabRequestModule {}
