import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientProfileController } from './patient-profile.controller';
import { PatientProfileService } from './patient-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatientProfileController],
  providers: [PatientProfileService],
})
export class PatientProfileModule {}
