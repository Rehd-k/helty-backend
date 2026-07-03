import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrescriptionRefillRequestStatus } from '@prisma/client';
import { AccountTypes } from '../../common/decorators';
import {
  BillPharmacyRefillRequestDto,
  ListPharmacyRefillRequestsQueryDto,
  UpdatePharmacyRefillRequestDto,
} from './dto/pharmacy-refill-request.dto';
import { PharmacyRefillRequestService } from './pharmacy.refill-request.service';

@ApiTags('Pharmacy')
@Controller('pharmacy/refill-requests')
@AccountTypes('PHARMACY')
export class PharmacyRefillRequestController {
  constructor(
    private readonly pharmacyRefillRequestService: PharmacyRefillRequestService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Pharmacy queue of patient prescription refill requests',
    description: 'Defaults to status=PENDING. Returns paginated { data, total, skip, take }.',
  })
  findAll(@Query() query: ListPharmacyRefillRequestsQueryDto) {
    return this.pharmacyRefillRequestService.findAll({
      ...query,
      status: query.status ?? PrescriptionRefillRequestStatus.PENDING,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one refill request' })
  findOne(@Param('id') id: string) {
    return this.pharmacyRefillRequestService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Approve, reject, or confirm fulfillment of a refill request',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePharmacyRefillRequestDto,
  ) {
    return this.pharmacyRefillRequestService.updateStatus(id, dto);
  }

  @Post(':id/bill')
  @ApiOperation({ summary: 'Bill an approved refill to an encounter invoice' })
  bill(@Param('id') id: string, @Body() dto: BillPharmacyRefillRequestDto) {
    return this.pharmacyRefillRequestService.bill(id, dto);
  }
}
