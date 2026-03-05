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
import { PharmacyStockTransferService } from './pharmacy.stock-transfer.service';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';
import { ListStockTransferDto } from './dto/list-stock-transfer.dto';

@ApiTags('Pharmacy - Stock Transfers')
@Controller('pharmacy/stock-transfers')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PharmacyStockTransferController {
  constructor(private readonly service: PharmacyStockTransferService) {}

  @Post()
  @ApiOperation({ summary: 'Create a stock transfer request' })
  create(@Body() dto: CreateStockTransferDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List stock transfers with filtering and pagination' })
  findAll(@Query() query: ListStockTransferDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending stock transfer' })
  approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approve(id, req.user?.sub);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete an approved transfer (moves stock)' })
  complete(@Param('id') id: string) {
    return this.service.complete(id);
  }
}
