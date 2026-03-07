import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WardRoundNotesController } from './ward-round-notes.controller';
import { WardRoundsController } from './ward-rounds.controller';
import { WardRoundNotesService } from './ward-round-notes.service';
import { WardRoundsService } from './ward-rounds.service';

@Module({
  imports: [PrismaModule],
  controllers: [WardRoundNotesController, WardRoundsController],
  providers: [WardRoundNotesService, WardRoundsService],
  exports: [WardRoundNotesService, WardRoundsService],
})
export class WardRoundNotesModule {}
