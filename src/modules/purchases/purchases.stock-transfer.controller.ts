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
import { AccountTypes } from '../../common/decorators';
import { PURCHASES_ACCESS } from './purchases.constants';
import { PurchasesStockTransferService } from './purchases.stock-transfer.service';
import {
  CreatePurchasesStockTransferDto,
  ListPurchasesStockTransferDto,
  TransferHistoryQueryDto,
} from './dto/stock-transfer.dto';

@ApiTags('Purchases - Stock Transfers')
@Controller('purchases/stock-transfers')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...PURCHASES_ACCESS)
export class PurchasesStockTransferController {
  constructor(private readonly service: PurchasesStockTransferService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create and complete a stock transfer (validates, approves, and moves stock in one step)',
  })
  create(
    @Body() dto: CreatePurchasesStockTransferDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'Completed transfer history for UI' })
  history(@Query() query: TransferHistoryQueryDto) {
    return this.service.history(query);
  }

  @Get()
  @ApiOperation({
    summary: 'List stock transfers with filtering and pagination',
  })
  findAll(@Query() query: ListPurchasesStockTransferDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending stock transfer' })
  approve(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.approve(id, req.user.sub);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete an approved transfer (moves stock)' })
  complete(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.complete(id, req.user.sub);
  }
}
