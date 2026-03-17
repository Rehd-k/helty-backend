import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NoIdPatientController } from './no-id-patient.controller';
import { NoIdPatientService } from './no-id-patient.service';

@Module({
  imports: [PrismaModule],
  controllers: [NoIdPatientController],
  providers: [NoIdPatientService],
  exports: [NoIdPatientService],
})
export class NoIdPatientModule {}
