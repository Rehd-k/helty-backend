import {
  Body,
  Controller,
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
import { PurchasesStockTransferService } from './purchases.stock-transfer.service';
import {
  CreatePurchasesStockTransferDto,
  ListPurchasesStockTransferDto,
  TransferHistoryQueryDto,
  UpdatePurchasesStockTransferDto,
} from './dto/stock-transfer.dto';

@ApiTags('Purchases - Stock Transfers')
@Controller('purchases/stock-transfers')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesStockTransferController {
  constructor(private readonly service: PurchasesStockTransferService) {}

  @Post()
  create(
    @Body() dto: CreatePurchasesStockTransferDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'Completed transfer history for UI' })
  history(@Query() query: TransferHistoryQueryDto) {
    return this.service.history(query);
  }

  @Get()
  findAll(@Query() query: ListPurchasesStockTransferDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchasesStockTransferDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(id, dto, req.user.sub);
  }
}
