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
import { PurchasesItemService } from './purchases.item.service';
import {
  CreatePurchaseItemDto,
  SearchPurchaseItemDto,
  UpdatePurchaseItemDto,
} from './dto/item.dto';

@ApiTags('Purchases - Items')
@Controller('purchases/items')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesItemController {
  constructor(private readonly service: PurchasesItemService) {}

  @Post()
  @ApiOperation({ summary: 'Create a purchase catalog item' })
  create(@Body() dto: CreatePurchaseItemDto, @Req() req: { user: { sub: string } }) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  search(@Query() query: SearchPurchaseItemDto) {
    return this.service.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseItemDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
