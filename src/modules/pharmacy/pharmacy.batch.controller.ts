import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PharmacyBatchService } from './pharmacy.batch.service';
import { SearchBatchDto } from './dto/search-batch.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Batches')
@Controller('pharmacy/batches')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyBatchController {
  constructor(private readonly batchService: PharmacyBatchService) {}

  @Get()
  @ApiOperation({
    summary:
      'List drug batches with filters for drug, supplier, location, dates, and stock availability',
  })
  async search(@Query() query: SearchBatchDto) {
    return this.batchService.search(query);
  }
}

