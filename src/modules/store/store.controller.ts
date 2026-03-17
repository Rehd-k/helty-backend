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
import { StoreService } from './store.service';
import { CreateStoreItemCategoryDto } from './dto/create-store-item-category.dto';
import { UpdateStoreItemCategoryDto } from './dto/update-store-item-category.dto';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { CreateStoreLocationDto } from './dto/create-store-location.dto';
import { UpdateStoreLocationDto } from './dto/update-store-location.dto';
import { IssueItemsDto } from './dto/issue-items.dto';
import { ReceiveItemsDto } from './dto/receive-items.dto';
import { TransferItemsDto } from './dto/transfer-items.dto';
import { StoreAnalyticsQueryDto } from './dto/store-analytics-query.dto';
import {
  ListStoreItemsQueryDto,
  ListStoreStockQueryDto,
} from './dto/list-store-query.dto';

@ApiTags('Store')
@Controller('store')
@UseGuards(JwtAuthGuard, AccessGuard)
export class StoreController {
  constructor(private readonly service: StoreService) {}

  // ─── Categories ─────────────────────────────────────────────────────────
  @Post('categories')
  @ApiOperation({ summary: 'Create store item category' })
  createCategory(@Body() dto: CreateStoreItemCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List store item categories' })
  findAllCategories(@Query('isActive') isActive?: string) {
    const active =
      isActive === undefined ? undefined : isActive === 'true';
    return this.service.findAllCategories(active);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category by ID' })
  findOneCategory(@Param('id') id: string) {
    return this.service.findOneCategory(id);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update store item category' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateStoreItemCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  // ─── Items ──────────────────────────────────────────────────────────────
  @Post('items')
  @ApiOperation({ summary: 'Create store item' })
  createItem(@Body() dto: CreateStoreItemDto) {
    return this.service.createItem(dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'List store items with filters' })
  findAllItems(@Query() query: ListStoreItemsQueryDto) {
    return this.service.findAllItems(query);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get store item by ID' })
  findOneItem(@Param('id') id: string) {
    return this.service.findOneItem(id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update store item' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateStoreItemDto) {
    return this.service.updateItem(id, dto);
  }

  // ─── Locations ───────────────────────────────────────────────────────────
  @Post('locations')
  @ApiOperation({ summary: 'Create store location' })
  createLocation(@Body() dto: CreateStoreLocationDto) {
    return this.service.createLocation(dto);
  }

  @Get('locations')
  @ApiOperation({ summary: 'List store locations' })
  findAllLocations(@Query('isActive') isActive?: string) {
    const active =
      isActive === undefined ? undefined : isActive === 'true';
    return this.service.findAllLocations(active);
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'Get store location by ID' })
  findOneLocation(@Param('id') id: string) {
    return this.service.findOneLocation(id);
  }

  @Patch('locations/:id')
  @ApiOperation({ summary: 'Update store location' })
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateStoreLocationDto,
  ) {
    return this.service.updateLocation(id, dto);
  }

  // ─── Stock ─────────────────────────────────────────────────────────────
  @Get('stock')
  @ApiOperation({ summary: 'List stock by location and/or item' })
  getStock(@Query() query: ListStoreStockQueryDto) {
    return this.service.getStock(query);
  }

  // ─── Movements ────────────────────────────────────────────────────────
  @Post('movements/issue')
  @ApiOperation({ summary: 'Issue items to a department' })
  issueItems(@Body() dto: IssueItemsDto, @Req() req: any) {
    return this.service.issueItems(dto, req.user?.sub);
  }

  @Post('movements/receive')
  @ApiOperation({ summary: 'Receive items (or return from department)' })
  receiveItems(@Body() dto: ReceiveItemsDto, @Req() req: any) {
    return this.service.receiveItems(dto, req.user?.sub);
  }

  @Post('movements/transfer')
  @ApiOperation({ summary: 'Transfer items between store locations' })
  transferItems(@Body() dto: TransferItemsDto, @Req() req: any) {
    return this.service.transferItems(dto, req.user?.sub);
  }

  // ─── Analytics ──────────────────────────────────────────────────────────
  @Get('analytics/dashboard')
  @ApiOperation({ summary: 'Dashboard analytics for store' })
  getAnalyticsDashboard(@Query() query: StoreAnalyticsQueryDto) {
    return this.service.getAnalyticsDashboard(query);
  }
}
