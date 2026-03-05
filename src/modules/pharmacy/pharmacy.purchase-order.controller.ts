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
import { PurchaseOrderStatus } from '@prisma/client';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { PharmacyPurchaseOrderService } from './pharmacy.purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/purchase-order.dto';
import { ListPurchaseOrderDto } from './dto/list-purchase-order.dto';

@ApiTags('Pharmacy - Purchase Orders')
@Controller('pharmacy/purchase-orders')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyPurchaseOrderController {
  constructor(private readonly service: PharmacyPurchaseOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchase order' })
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List purchase orders with filtering and pagination' })
  findAll(@Query() query: ListPurchaseOrderDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update purchase order status (e.g. approve)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: PurchaseOrderStatus,
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, status, req.user?.sub);
  }
}
