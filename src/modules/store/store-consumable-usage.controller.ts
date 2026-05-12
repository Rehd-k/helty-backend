import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { ConsumableUsageService } from './consumable-usage.service';
import {
  ListConsumableHistoryQueryDto,
  RecordConsumableUsageDto,
} from './dto/consumable-usage.dto';

@ApiTags('Store — Consumable usage (non-billable)')
@Controller('store/consumables/usage')
@UseGuards(JwtAuthGuard, AccessGuard)
export class StoreConsumableUsageController {
  constructor(private readonly usage: ConsumableUsageService) {}

  @Post()
  @ApiOperation({
    summary: 'Record non-billable consumable use (nursing / procedure); deducts FIFO stock',
  })
  @AccountTypes(
    'NURSE',
    'HEAD_NURSE',
    'INPATIENT_NURSE',
    'OUTPATIENT_NURSE',
    'PHYSICIAN',
    'CONSULTANT',
    'RESIDENT',
    'INTERN',
    'SUPER_ADMIN',
  )
  record(@Body() dto: RecordConsumableUsageDto, @Req() req: { user: { sub: string } }) {
    return this.usage.recordNonBillableUse(dto, req.user.sub);
  }

  @Post(':usageEventId/return')
  @ApiOperation({
    summary: 'Full return of a prior non-billable USE event (restocks FIFO)',
  })
  @AccountTypes(
    'NURSE',
    'HEAD_NURSE',
    'INPATIENT_NURSE',
    'OUTPATIENT_NURSE',
    'PHYSICIAN',
    'CONSULTANT',
    'RESIDENT',
    'INTERN',
    'SUPER_ADMIN',
  )
  returnUse(
    @Param('usageEventId') usageEventId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.usage.returnNonBillableUse(usageEventId, req.user.sub);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Unified usage events and stock movements for consumables',
  })
  @AccountTypes(
    'STORE',
    'SUPER_ADMIN',
    'HEAD_OF_STORE',
    'STOREKEEPER',
    'NURSE',
    'HEAD_NURSE',
    'INPATIENT_NURSE',
    'OUTPATIENT_NURSE',
    'PHYSICIAN',
    'CONSULTANT',
  )
  history(@Query() query: ListConsumableHistoryQueryDto) {
    return this.usage.listHistory(query);
  }
}
