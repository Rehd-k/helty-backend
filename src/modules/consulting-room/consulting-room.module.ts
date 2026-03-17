import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsultingRoomService } from './consulting-room.service';
import { ConsultingRoomController } from './consulting-room.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ConsultingRoomController],
  providers: [ConsultingRoomService],
  exports: [ConsultingRoomService],
})
export class ConsultingRoomModule {}
