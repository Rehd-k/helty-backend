import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PatientAvatarController } from './patient-avatar.controller';
import { PatientPhotoStorageService } from './patient-photo-storage.service';
import { PatientProfileController } from './patient-profile.controller';
import { PatientProfilePhotoController } from './patient-profile-photo.controller';
import { PatientProfilePhotoService } from './patient-profile-photo.service';
import { PatientProfileService } from './patient-profile.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PatientProfileController,
    PatientProfilePhotoController,
    PatientAvatarController,
  ],
  providers: [
    PatientProfileService,
    PatientProfilePhotoService,
    PatientPhotoStorageService,
  ],
})
export class PatientProfileModule {}
