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
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesBatchService } from './purchases.batch.service';
import {
  CorrectBatchQuantityDto,
  CreatePurchaseItemBatchDto,
  SearchPurchaseItemBatchDto,
  UpdatePurchaseItemBatchDto,
} from './dto/batch.dto';

@ApiTags('Purchases - Batches')
@Controller('purchases/batches')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesBatchController {
  constructor(private readonly service: PurchasesBatchService) {}

  @Post()
  create(@Body() dto: CreatePurchaseItemBatchDto, @Req() req: { user: { sub: string } }) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  search(@Query() query: SearchPurchaseItemBatchDto) {
    return this.service.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/quantity-correction')
  @ApiOperation({ summary: 'Correct batch quantities (head only, 24h+)' })
  correctQuantity(
    @Param('id') id: string,
    @Body() dto: CorrectBatchQuantityDto,
    @Req() req: { user: { staffRole?: string } },
  ) {
    return this.service.correctQuantity(id, dto, req.user.staffRole);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseItemBatchDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
