import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PharmacyDrugService } from './pharmacy.drug.service';
import { SearchDrugDto } from './dto/search-drug.dto';
import { CreateDrugDto, UpdateDrugDto } from './dto/drug.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Drugs')
@Controller('pharmacy/drugs')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyDrugController {
  constructor(private readonly drugService: PharmacyDrugService) {}

  @Post()
  @ApiOperation({ summary: 'Create a drug' })
  create(@Body() dto: CreateDrugDto, @Req() req: any) {
    return this.drugService.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Search drugs with advanced filtering and cursor-based pagination',
  })
  search(@Query() query: SearchDrugDto) {
    return this.drugService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drug by ID' })
  findOne(@Param('id') id: string) {
    return this.drugService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a drug' })
  update(@Param('id') id: string, @Body() dto: UpdateDrugDto, @Req() req: any) {
    return this.drugService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a drug' })
  remove(@Param('id') id: string) {
    return this.drugService.remove(id);
  }
}
