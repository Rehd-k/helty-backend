import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientFamilyController } from './patient-family.controller';
import { PatientFamilyService } from './patient-family.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientFamilyController],
  providers: [PatientFamilyService],
  exports: [PatientFamilyService],
})
export class PatientFamilyModule {}
