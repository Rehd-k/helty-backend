import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClinicalPackageController } from './clinical-package.controller';
import { ClinicalPackageService } from './clinical-package.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClinicalPackageController],
  providers: [ClinicalPackageService],
  exports: [ClinicalPackageService],
})
export class ClinicalPackageModule {}
