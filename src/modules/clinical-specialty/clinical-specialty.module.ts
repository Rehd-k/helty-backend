import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncounterModule } from '../encounter/encounter.module';
import { ClinicalSpecialtyCatalogController } from './clinical-specialty-catalog.controller';
import { EncounterSpecialtyController } from './encounter-specialty.controller';
import { EncounterSpecialtyService } from './encounter-specialty.service';

@Module({
  imports: [PrismaModule, EncounterModule],
  controllers: [
    ClinicalSpecialtyCatalogController,
    EncounterSpecialtyController,
  ],
  providers: [EncounterSpecialtyService],
  exports: [EncounterSpecialtyService],
})
export class ClinicalSpecialtyModule {}
