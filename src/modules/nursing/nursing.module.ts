import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NursingRosterController } from './nursing-roster.controller';
import { NursingRosterService } from './nursing-roster.service';
import { NursingAssignmentController } from './nursing-assignment.controller';
import { OutpatientNurseAssignmentService } from './outpatient-nurse-assignment.service';
import { InpatientNurseAssignmentListService } from './inpatient-nurse-assignment-list.service';

@Module({
  imports: [PrismaModule],
  controllers: [NursingRosterController, NursingAssignmentController],
  providers: [
    NursingRosterService,
    OutpatientNurseAssignmentService,
    InpatientNurseAssignmentListService,
  ],
  exports: [
    NursingRosterService,
    OutpatientNurseAssignmentService,
    InpatientNurseAssignmentListService,
  ],
})
export class NursingModule {}
