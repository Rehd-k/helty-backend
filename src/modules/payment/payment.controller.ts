import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/create-payment.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

const LEGACY_PAYMENTS_REMOVED =
  'This API is retired. Record bill payments with POST /invoices/:id/payments or POST /invoices/:id/allocate-item-payments. ' +
  'Patient prepayments use POST /invoices/wallets/:patientId/deposits. See docs/FLUTTER_BILLING_MIGRATION.md.';

@ApiTags('Payment')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Record a new payment (removed)',
    description: LEGACY_PAYMENTS_REMOVED,
    deprecated: true,
  })
  create(@Body() _createPaymentDto: CreatePaymentDto) {
    throw new GoneException(LEGACY_PAYMENTS_REMOVED);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all payments (legacy read-only)',
    description:
      'Historical `Payment` rows only. Active billing uses invoices and InvoicePayment.',
    deprecated: true,
  })
  findAll(@Query() query: DateRangeSkipTakeDto) {
    return this.paymentService.findAll(query);
  }

  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'Get all payments for a patient (legacy read-only)',
    deprecated: true,
  })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.paymentService.findByPatientId(patientId);
  }

  @Get('patient/:patientId/total')
  @ApiOperation({
    summary: 'Get total payments and count for a patient (legacy read-only)',
    deprecated: true,
  })
  getTotalPaymentsByPatient(@Param('patientId') patientId: string) {
    return this.paymentService.getTotalPaymentsByPatient(patientId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment by ID (legacy read-only)',
    deprecated: true,
  })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Update payment record (removed)',
    description: LEGACY_PAYMENTS_REMOVED,
    deprecated: true,
  })
  update(
    @Param('id') _id: string,
    @Body() _updatePaymentDto: UpdatePaymentDto,
  ) {
    throw new GoneException(LEGACY_PAYMENTS_REMOVED);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Delete payment record (removed)',
    description: LEGACY_PAYMENTS_REMOVED,
    deprecated: true,
  })
  remove(@Param('id') _id: string) {
    throw new GoneException(LEGACY_PAYMENTS_REMOVED);
  }
}
