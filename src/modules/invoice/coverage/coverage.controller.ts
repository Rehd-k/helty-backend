import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../../common/decorators/account-types.decorator';
import { InvoiceCoverageService } from './coverage.service';
import { ApplyHmoCoverageDto } from './dto/apply-hmo-coverage.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { ReverseCoverageDto } from './dto/reverse-coverage.dto';

@ApiTags('Invoice Coverages')
@Controller('invoices/:invoiceId/coverages')
export class InvoiceCoverageController {
  constructor(private readonly coverageService: InvoiceCoverageService) { }

  @Get()
  @ApiOperation({ summary: 'List coverages on an invoice' })
  @ApiParam({ name: 'invoiceId', description: 'Invoice UUID' })
  list(@Param('invoiceId') invoiceId: string) {
    return this.coverageService.listCoverages(invoiceId);
  }

  @Post('hmo')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply HMO coverage to an invoice' })
  @AccountTypes('HMO', 'SUPER_ADMIN')
  applyHmo(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: ApplyHmoCoverageDto,
    @Req() req: any,
  ) {
    return this.coverageService.applyHmoCoverage(invoiceId, dto, req?.user?.sub);
  }

  @Post('discount')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply a discount policy to an invoice' })
  @AccountTypes('BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  applyDiscount(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: ApplyDiscountDto,
    @Req() req: any,
  ) {
    return this.coverageService.applyDiscount(invoiceId, dto, req?.user?.sub);
  }

  @Delete(':coverageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse (void) an applied invoice coverage' })
  @AccountTypes('HMO', 'BILLS', 'BILLING', 'CMD', 'CMAC', 'SUPER_ADMIN')
  reverse(
    @Param('invoiceId') invoiceId: string,
    @Param('coverageId') coverageId: string,
    @Body() dto: ReverseCoverageDto,
    @Req() req: any,
  ) {
    return this.coverageService.reverseCoverage(
      invoiceId,
      coverageId,
      req?.user?.sub,
      dto.reason,
    );
  }
}

