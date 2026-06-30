import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { BillingSummaryResponseDto } from './dto/billing-summary-response.dto';
import { InvoiceDetailDto } from './dto/invoice-detail.dto';
import {
  InvoiceListResponseDto,
} from './dto/invoice-summary.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import {
  PaymentListResponseDto,
  ReceiptResponseDto,
} from './dto/payment-summary.dto';
import { PatientBillingService } from './patient-billing.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientBillingController {
  constructor(private readonly patientBillingService: PatientBillingService) {}

  @Get('billing/summary')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Billing dashboard summary (outstanding balance, due date)' })
  @ApiResponse({ status: 200, type: BillingSummaryResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getBillingSummary(@Request() req: { user: PatientJwtPayload }) {
    return this.patientBillingService.getBillingSummary(req.user);
  }

  @Get('invoices')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient invoices (bills)' })
  @ApiResponse({ status: 200, type: InvoiceListResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  listInvoices(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.patientBillingService.listInvoices(req.user, query);
  }

  @Get('invoices/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get invoice detail with inpatient charge breakdown by category',
  })
  @ApiResponse({ status: 200, type: InvoiceDetailDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getInvoice(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientBillingService.getInvoice(req.user, id);
  }

  @Get('payments')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient payment history across all invoices' })
  @ApiResponse({ status: 200, type: PaymentListResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  listPayments(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.patientBillingService.listPayments(req.user, query);
  }

  @Get('receipts/:paymentId')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment receipt metadata (PDF URL when available)' })
  @ApiResponse({ status: 200, type: ReceiptResponseDto })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  getReceipt(
    @Request() req: { user: PatientJwtPayload },
    @Param('paymentId') paymentId: string,
  ) {
    return this.patientBillingService.getReceipt(req.user, paymentId);
  }
}
