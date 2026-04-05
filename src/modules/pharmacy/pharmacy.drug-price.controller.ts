import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PharmacyDrugPriceService } from './pharmacy.drug-price.service';
import {
  CreateDrugPriceDto,
  SearchDrugPriceDto,
  UpdateDrugPriceDto,
} from './dto/drug-price.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Drug Prices')
@Controller('pharmacy/drug-prices')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyDrugPriceController {
  constructor(private readonly drugPriceService: PharmacyDrugPriceService) {}

  @Post()
  @ApiOperation({ summary: 'Create ward-specific drug pricing' })
  create(@Body() dto: CreateDrugPriceDto) {
    return this.drugPriceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List or search drug prices' })
  search(@Query() query: SearchDrugPriceDto) {
    return this.drugPriceService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drug price by ID' })
  findOne(@Param('id') id: string) {
    return this.drugPriceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a drug price row' })
  update(@Param('id') id: string, @Body() dto: UpdateDrugPriceDto) {
    return this.drugPriceService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a drug price row' })
  remove(@Param('id') id: string) {
    return this.drugPriceService.remove(id);
  }
}
