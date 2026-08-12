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
import { LabAntibioticController } from './lab-antibiotic/lab-antibiotic.controller';
import { LabAntibioticService } from './lab-antibiotic/lab-antibiotic.service';
import { LabAstResultOptionController } from './lab-ast-result-option/lab-ast-result-option.controller';
import { LabAstResultOptionService } from './lab-ast-result-option/lab-ast-result-option.service';
import { LabAstResultController } from './lab-ast-result/lab-ast-result.controller';
import { LabAstResultService } from './lab-ast-result/lab-ast-result.service';
import { LabInvestigationsController } from './lab-investigations/lab-investigations.controller';
import { LabInvestigationsService } from './lab-investigations/lab-investigations.service';
import { LabConfigTransferController } from './lab-config-transfer/lab-config-transfer.controller';
import { LabConfigTransferService } from './lab-config-transfer/lab-config-transfer.service';

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
    LabAntibioticController,
    LabAstResultOptionController,
    LabAstResultController,
    LabInvestigationsController,
    LabConfigTransferController,
  ],
  providers: [
    LabCategoryService,
    LabTestService,
    LabTestVersionService,
    LabTestFieldService,
    LabOrderService,
    LabSampleService,
    LabResultService,
    LabAntibioticService,
    LabAstResultOptionService,
    LabAstResultService,
    LabInvestigationsService,
    LabConfigTransferService,
  ],
  exports: [
    LabCategoryService,
    LabTestService,
    LabTestVersionService,
    LabTestFieldService,
    LabOrderService,
    LabSampleService,
    LabResultService,
    LabAntibioticService,
    LabAstResultOptionService,
    LabAstResultService,
    LabInvestigationsService,
    LabConfigTransferService,
  ],
})
export class LabModule {}
