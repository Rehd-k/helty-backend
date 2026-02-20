import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServiceCategoryService } from './service-category.service';
import { ServiceCategoryController } from './service-category.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceController, ServiceCategoryController],
  providers: [ServiceService, ServiceCategoryService],
  exports: [ServiceService, ServiceCategoryService],
})
export class ServiceModule {}
