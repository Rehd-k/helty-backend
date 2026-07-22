import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PregnancyController } from './pregnancy.controller';
import { AntenatalVisitController } from './antenatal-visit.controller';
import { LabourDeliveryController } from './labour-delivery.controller';
import { PartogramController } from './partogram.controller';
import { BabyController } from './baby.controller';
import { PostnatalVisitController } from './postnatal-visit.controller';
import { GynaeProcedureController } from './gynae-procedure.controller';
import { PregnancyService } from './pregnancy.service';
import { AntenatalVisitService } from './antenatal-visit.service';
import { LabourDeliveryService } from './labour-delivery.service';
import { PartogramService } from './partogram.service';
import { BabyService } from './baby.service';
import { PostnatalVisitService } from './postnatal-visit.service';
import { GynaeProcedureService } from './gynae-procedure.service';
import { PregnancyClinicalContextService } from './pregnancy-clinical-context.service';
import { PregnancyClinicalService } from './pregnancy-clinical.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PregnancyController,
    AntenatalVisitController,
    LabourDeliveryController,
    PartogramController,
    BabyController,
    PostnatalVisitController,
    GynaeProcedureController,
  ],
  providers: [
    PregnancyService,
    AntenatalVisitService,
    LabourDeliveryService,
    PartogramService,
    BabyService,
    PostnatalVisitService,
    GynaeProcedureService,
    PregnancyClinicalContextService,
    PregnancyClinicalService,
  ],
  exports: [
    PregnancyService,
    AntenatalVisitService,
    LabourDeliveryService,
    PartogramService,
    BabyService,
    PostnatalVisitService,
    GynaeProcedureService,
    PregnancyClinicalContextService,
    PregnancyClinicalService,
  ],
})
export class ObstetricsModule {}
