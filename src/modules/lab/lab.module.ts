import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { LabCategoryController } from './lab-category/lab-category.controller';
import { LabCategoryService } from './lab-category/lab-category.service';
import { LabTestController } from './lab-test/lab-test.controller';
import { LabTestService } from './lab-test/lab-test.service';
import { LabTestVersionController } from './lab-test-version/lab-test-version.controller';
import { LabTestVersionService } from './lab-test-version/lab-test-version.service';
import { LabTestFieldController } from './lab-test-field/lab-test-field.controller';
import { LabTestFieldService } from './lab-test-field/lab-test-field.service';
import { LabOrderController } from './lab-order/lab-order.controller';
import { LabOrderService } from './lab-order/lab-order.service';
import { LabSampleController } from './lab-sample/lab-sample.controller';
import { LabSampleService } from './lab-sample/lab-sample.service';
import { LabResultController } from './lab-result/lab-result.controller';
import { LabResultService } from './lab-result/lab-result.service';

@Module({
  imports: [PrismaModule, InvoiceModule],
  controllers: [
    LabCategoryController,
    LabTestController,
    LabTestVersionController,
    LabTestFieldController,
    LabOrderController,
    LabSampleController,
    LabResultController,
  ],
  providers: [
    LabCategoryService,
    LabTestService,
    LabTestVersionService,
    LabTestFieldService,
    LabOrderService,
    LabSampleService,
    LabResultService,
  ],
  exports: [
    LabCategoryService,
    LabTestService,
    LabTestVersionService,
    LabTestFieldService,
    LabOrderService,
    LabSampleService,
    LabResultService,
  ],
})
export class LabModule {}
