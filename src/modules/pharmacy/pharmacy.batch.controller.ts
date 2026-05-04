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
import {
  CorrectBatchQuantityDto,
  CreateBatchDto,
  SyncWardPricingFromLatestBatchDto,
  UpdateBatchDto,
} from './dto/batch.dto';
import { SearchBatchDto } from './dto/search-batch.dto';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';

@ApiTags('Pharmacy - Batches')
@Controller('pharmacy/batches')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyBatchController {
  constructor(private readonly batchService: PharmacyBatchService) {}

  @Get('preview-ward-pricing/:id')
  @ApiOperation({
    summary:
      'Sync ward drug prices from the latest batch cost for this drug (body: drugId only). No update if there are no batches.',
  })
  syncWardPricingFromLatestBatch(@Param('id') id: string) {
    return this.batchService.syncWardPricingFromLatestBatch(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a drug batch' })
  create(@Body() dto: CreateBatchDto) {
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

  @Patch(':id/quantity-correction')
  @ApiOperation({
    summary: 'Correct wrong quantity (data entry)',
    description:
      'Sets quantityReceived and quantityRemaining. Allowed only if the batch was created at least 24 hours ago. The generic PATCH on this resource also updates quantity but has no time restriction.',
  })
  correctQuantity(
    @Param('id') id: string,
    @Body() dto: CorrectBatchQuantityDto,
  ) {
    return this.batchService.correctQuantity(id, dto);
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
