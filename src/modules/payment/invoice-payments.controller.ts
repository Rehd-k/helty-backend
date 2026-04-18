import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
  CreateInvoicePaymentBodyDto,
  UpdateInvoicePaymentDto,
  VoidInvoicePaymentQueryDto,
} from './dto/invoice-payment.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicePaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record invoice payment (by invoice id in body)',
    description:
      'Same behavior as POST /invoices/:id/payments. The authenticated staff id is used as createdBy/receivedBy when present.',
  })
  @ApiCreatedResponse({ description: 'Payment recorded' })
  recordPayment(@Body() body: CreateInvoicePaymentBodyDto, @Req() req: any) {
    const { invoiceId, ...dto } = body;
    return this.paymentService.recordInvoicePayment(
      invoiceId,
      dto,
      req?.user?.sub,
    );
  }

  @Get('payments/:id')
  @ApiOperation({
    summary: 'Get one invoice payment by id',
    description:
      'Returns the InvoicePayment with invoice summary, wallet transaction, bank, staff, and line allocations.',
  })
  @ApiParam({ name: 'id', description: 'InvoicePayment UUID' })
  @ApiOkResponse({ description: 'Invoice payment detail' })
  findInvoicePayment(@Param('id') id: string) {
    return this.paymentService.findInvoicePaymentById(id);
  }

  @Patch('payments/:id')
  @ApiOperation({
    summary: 'Update invoice payment metadata',
    description:
      'Safe fields only: reference, notes, paidAt, receivedById, bankId. ' +
      'Does not change amount, source, method, or invoice. Use DELETE to void, then record again for monetary fixes.',
  })
  @ApiParam({ name: 'id', description: 'InvoicePayment UUID' })
  @ApiOkResponse({ description: 'Updated invoice payment' })
  updateInvoicePayment(
    @Param('id') id: string,
    @Body() dto: UpdateInvoicePaymentDto,
  ) {
    return this.paymentService.updateInvoicePayment(id, dto);
  }

  @Delete('payments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void an invoice payment',
    description:
      'Reverses line allocations, invoice amountPaid, and wallet debit when applicable; removes the payment and writes an audit log. Optional `reason` query parameter.',
  })
  @ApiParam({ name: 'id', description: 'InvoicePayment UUID' })
  @ApiOkResponse({ description: 'Payment voided; returns updated invoice snapshot' })
  removeInvoicePayment(
    @Param('id') id: string,
    @Query() query: VoidInvoicePaymentQueryDto,
    @Req() req: any,
  ) {
    return this.paymentService.removeInvoicePayment(
      id,
      req?.user?.sub,
      query.reason,
    );
  }
}
