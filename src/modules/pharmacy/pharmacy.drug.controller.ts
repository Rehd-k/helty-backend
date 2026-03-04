import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PharmacyDrugService } from './pharmacy.drug.service';
import { SearchDrugDto } from './dto/search-drug.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Drugs')
@Controller('pharmacy/drugs')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyDrugController {
  constructor(private readonly drugService: PharmacyDrugService) {}

  @Get()
  @ApiOperation({
    summary: 'Search drugs with advanced filtering and cursor-based pagination',
  })
  async search(@Query() query: SearchDrugDto) {
    return this.drugService.search(query);
  }
}

