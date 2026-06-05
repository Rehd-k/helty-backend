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
import { PurchasesSupplierService } from './purchases.supplier.service';
import {
  CreatePurchasesSupplierDto,
  ListPurchasesSupplierDto,
  UpdatePurchasesSupplierDto,
} from './dto/supplier.dto';

@ApiTags('Purchases - Suppliers')
@Controller('purchases/suppliers')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesSupplierController {
  constructor(private readonly service: PurchasesSupplierService) {}

  @Post()
  create(@Body() dto: CreatePurchasesSupplierDto, @Req() req: { user: { sub: string } }) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  findAll(@Query() query: ListPurchasesSupplierDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchasesSupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
