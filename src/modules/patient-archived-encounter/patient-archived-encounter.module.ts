import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientArchivedEncounterController } from './patient-archived-encounter.controller';
import { PatientArchivedEncounterService } from './patient-archived-encounter.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientArchivedEncounterController],
  providers: [PatientArchivedEncounterService],
  exports: [PatientArchivedEncounterService],
})
export class PatientArchivedEncounterModule {}
