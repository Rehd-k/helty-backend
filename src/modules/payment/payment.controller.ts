import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/create-payment.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DateRangeSkipTakeDto } from '../../common/dto/date-range.dto';

@ApiTags('Payment')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new payment' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments' })
  findAll(@Query() query: DateRangeSkipTakeDto) {
    return this.paymentService.findAll(query);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all payments for a patient' })
  findByPatientId(@Param('patientId') patientId: string) {
    return this.paymentService.findByPatientId(patientId);
  }

  @Get('patient/:patientId/total')
  @ApiOperation({ summary: 'Get total payments and count for a patient' })
  getTotalPaymentsByPatient(@Param('patientId') patientId: string) {
    return this.paymentService.getTotalPaymentsByPatient(patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payment record' })
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment record' })
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id);
  }
}
