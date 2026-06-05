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
import { PurchasesManufacturerService } from './purchases.manufacturer.service';
import {
  CreatePurchasesManufacturerDto,
  ListPurchasesManufacturerDto,
  UpdatePurchasesManufacturerDto,
} from './dto/manufacturer.dto';

@ApiTags('Purchases - Manufacturers')
@Controller('purchases/manufacturers')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesManufacturerController {
  constructor(private readonly service: PurchasesManufacturerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchases manufacturer' })
  create(@Body() dto: CreatePurchasesManufacturerDto, @Req() req: { user: { sub: string } }) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  findAll(@Query() query: ListPurchasesManufacturerDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePurchasesManufacturerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
