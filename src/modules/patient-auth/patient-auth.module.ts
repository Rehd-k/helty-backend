import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PatientAuthController],
  providers: [PatientAuthService],
  exports: [PatientAuthService],
})
export class PatientAuthModule {}
