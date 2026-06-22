import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MedicationRequestStatus } from '@prisma/client';
import { MedicationRequestService } from '../medication-request/medication-request.service';
import { ListMedicationRequestsQueryDto } from '../medication-request/dto/create-medication-request.dto';

@ApiTags('Pharmacy')
@Controller('pharmacy/medication-requests')
export class PharmacyMedicationRequestController {
  constructor(
    private readonly medicationRequestService: MedicationRequestService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Pharmacy queue of medication requests awaiting billing',
    description:
      'Defaults to status=REQUESTED. Alias of GET /medication-requests for the pharmacy review page.',
  })
  findQueue(@Query() query: ListMedicationRequestsQueryDto) {
    return this.medicationRequestService.findAll({
      ...query,
      status: query.status ?? MedicationRequestStatus.REQUESTED,
    });
  }
}
