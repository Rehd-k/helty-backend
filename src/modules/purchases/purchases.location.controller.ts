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
import { PurchasesLocationService } from './purchases.location.service';
import {
  CreatePurchasesLocationDto,
  ListPurchasesLocationDto,
  UpdatePurchasesLocationDto,
} from './dto/location.dto';

@ApiTags('Purchases - Locations')
@Controller('purchases/locations')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesLocationController {
  constructor(private readonly service: PurchasesLocationService) {}

  @Post()
  create(@Body() dto: CreatePurchasesLocationDto, @Req() req: { user: { sub: string } }) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  findAll(@Query() query: ListPurchasesLocationDto) {
    return this.service.findAll(query);
  }

  @Get('item/:itemId/quantity')
  @ApiOperation({ summary: 'Quantity of item per location' })
  itemQuantity(
    @Param('itemId') itemId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.service.getItemQuantityByLocation(itemId, locationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchasesLocationDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
