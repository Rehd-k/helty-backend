import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyGoodsReceiptService } from './pharmacy.goods-receipt.service';
import { CreateGoodsReceiptDto } from './dto/goods-receipt.dto';

@ApiTags('Pharmacy - Goods Receipts')
@Controller('pharmacy/goods-receipts')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyGoodsReceiptController {
  constructor(private readonly service: PharmacyGoodsReceiptService) {}

  @Post()
  @ApiOperation({
    summary: 'Receive goods against a purchase order (creates GR + batches)',
  })
  create(@Body() dto: CreateGoodsReceiptDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get('by-purchase-order/:purchaseOrderId')
  @ApiOperation({ summary: 'List goods receipts for a purchase order' })
  findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.service.findByPurchaseOrderId(purchaseOrderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get goods receipt by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
