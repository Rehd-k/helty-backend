import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { Icd10Controller } from './icd10.controller';
import { Icd10Service } from './icd10.service';

@Module({
  imports: [PrismaModule],
  controllers: [Icd10Controller],
  providers: [Icd10Service],
  exports: [Icd10Service],
})
export class Icd10Module {}
