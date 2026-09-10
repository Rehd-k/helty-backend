import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DepartmentHeadController } from './department-head.controller';
import { DepartmentHeadService } from './department-head.service';

@Module({
  imports: [PrismaModule],
  controllers: [DepartmentHeadController],
  providers: [DepartmentHeadService],
  exports: [DepartmentHeadService],
})
export class DepartmentHeadModule {}
