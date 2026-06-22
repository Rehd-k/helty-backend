import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { StoreModule } from '../store/store.module';
import { TheatreRoomController } from './theatre-room.controller';
import { TheatreRoomService } from './theatre-room.service';
import { SurgeryRequestController } from './surgery-request.controller';
import { SurgeryRequestService } from './surgery-request.service';
import { TheatreScheduleController } from './theatre-schedule.controller';
import { TheatreScheduleService } from './theatre-schedule.service';
import { TheatreCaseController } from './theatre-case.controller';
import { TheatreCaseService } from './theatre-case.service';

@Module({
  imports: [PrismaModule, InvoiceModule, StoreModule],
  controllers: [
    TheatreRoomController,
    SurgeryRequestController,
    TheatreScheduleController,
    TheatreCaseController,
  ],
  providers: [
    TheatreRoomService,
    SurgeryRequestService,
    TheatreScheduleService,
    TheatreCaseService,
  ],
  exports: [
    SurgeryRequestService,
    TheatreScheduleService,
    TheatreCaseService,
  ],
})
export class TheatreModule {}
