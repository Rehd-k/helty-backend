import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesGoodsReceiptService } from './purchases.goods-receipt.service';
import { CreatePurchasesGoodsReceiptDto } from './dto/goods-receipt.dto';

@ApiTags('Purchases - Goods Receipts')
@Controller('purchases/goods-receipts')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesGoodsReceiptController {
  constructor(private readonly service: PurchasesGoodsReceiptService) {}

  @Post()
  create(
    @Body() dto: CreatePurchasesGoodsReceiptDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Get('purchase-order/:purchaseOrderId')
  findByPo(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.service.findByPurchaseOrderId(purchaseOrderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
