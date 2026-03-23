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
import { PharmacyBatchService } from './pharmacy.batch.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/batch.dto';
import { SearchBatchDto } from './dto/search-batch.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Batches')
@Controller('pharmacy/batches')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyBatchController {
  constructor(private readonly batchService: PharmacyBatchService) {}

  @Post()
  @ApiOperation({ summary: 'Create a drug batch' })
  create(@Body() dto: any) {
     return this.batchService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List drug batches with filters for drug, supplier, location, dates, and stock availability',
  })
  search(@Query() query: SearchBatchDto) {
    return this.batchService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drug batch by ID' })
  findOne(@Param('id') id: string) {
    return this.batchService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a drug batch' })
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batchService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete a drug batch (only when not linked to movements/transfers/dispensations)',
  })
  remove(@Param('id') id: string) {
    return this.batchService.remove(id);
  }
}
