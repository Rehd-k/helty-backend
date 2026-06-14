import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncounterTemplateController } from './encounter-template.controller';
import { EncounterTemplateService } from './encounter-template.service';

@Module({
  imports: [PrismaModule],
  controllers: [EncounterTemplateController],
  providers: [EncounterTemplateService],
  exports: [EncounterTemplateService],
})
export class EncounterTemplateModule {}
