import { Module } from '@nestjs/common';
import { DisplayBoardService } from './display-board.service';
import { DisplayController } from './display.controller';
import { DisplayVideoService } from './display-video.service';

@Module({
  controllers: [DisplayController],
  providers: [DisplayBoardService, DisplayVideoService],
})
export class DisplayModule {}
