import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { StoreConsumableService } from './store-consumable.service';
import { ConsumableAnalyticsService } from './consumable-analytics.service';
import {
  CreateConsumableBatchDto,
  CreateConsumableDto,
  UpdateConsumableDto,
} from './dto/consumable.dto';
import { ListConsumableDto } from './dto/list-consumable.dto';
import { ConsumableAnalyticsQueryDto } from './dto/consumable-analytics-query.dto';

@ApiTags('Store — Consumables')
@Controller('store/consumables')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('STORE', 'SUPER_ADMIN', 'HEAD_OF_STORE', 'STOREKEEPER')
export class StoreConsumableController {
  constructor(
    private readonly consumables: StoreConsumableService,
    private readonly analytics: ConsumableAnalyticsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a consumable catalog entry' })
  create(@Body() dto: CreateConsumableDto) {
    return this.consumables.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List consumables' })
  findAll(@Query() query: ListConsumableDto) {
    return this.consumables.findAll(query);
  }

  @Get('analytics/summary')
  @ApiOperation({
    summary: 'Sales, COGS, margin and top consumables (from stock allocations)',
  })
  analyticsSummary(@Query() query: ConsumableAnalyticsQueryDto) {
    return this.analytics.summary(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consumable by ID' })
  findOne(@Param('id') id: string) {
    return this.consumables.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update consumable' })
  update(@Param('id') id: string, @Body() dto: UpdateConsumableDto) {
    return this.consumables.update(id, dto);
  }

  @Post(':id/batches')
  @ApiOperation({ summary: 'Create a batch at a store location' })
  createBatch(@Param('id') id: string, @Body() dto: CreateConsumableBatchDto) {
    return this.consumables.createBatch(id, dto);
  }

  @Get(':id/batches')
  @ApiOperation({ summary: 'List batches for a consumable' })
  listBatches(@Param('id') id: string) {
    return this.consumables.listBatches(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete consumable (no batches or prescription items)' })
  remove(@Param('id') id: string) {
    return this.consumables.remove(id);
  }
}
