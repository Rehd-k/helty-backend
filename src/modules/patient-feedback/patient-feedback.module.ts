import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientFeedbackController } from './patient-feedback.controller';
import { PatientFeedbackService } from './patient-feedback.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientFeedbackController],
  providers: [PatientFeedbackService],
  exports: [PatientFeedbackService],
})
export class PatientFeedbackModule {}
