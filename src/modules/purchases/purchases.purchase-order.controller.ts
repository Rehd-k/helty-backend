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
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesPurchaseOrderService } from './purchases.purchase-order.service';
import {
  CreatePurchasesPurchaseOrderDto,
  ListPurchasesPurchaseOrderDto,
  UpdatePurchasesPurchaseOrderStatusDto,
} from './dto/purchase-order.dto';

@ApiTags('Purchases - Purchase Orders')
@Controller('purchases/purchase-orders')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesPurchaseOrderController {
  constructor(private readonly service: PurchasesPurchaseOrderService) {}

  @Post()
  create(
    @Body() dto: CreatePurchasesPurchaseOrderDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  findAll(@Query() query: ListPurchasesPurchaseOrderDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchasesPurchaseOrderStatusDto,
    @Req() req: { user: { sub: string; staffRole?: string } },
  ) {
    return this.service.updateStatus(
      id,
      dto.status,
      req.user.sub,
      req.user.staffRole,
    );
  }
}
