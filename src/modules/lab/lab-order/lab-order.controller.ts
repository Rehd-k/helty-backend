import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabOrderService } from './lab-order.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@ApiTags('Lab – Orders')
@Controller('lab/orders')
export class LabOrderController {
  constructor(private readonly labOrderService: LabOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lab order with items (only active test versions)' })
  create(@Body() dto: CreateLabOrderDto) {
    return this.labOrderService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List lab orders with optional filters' })
  findAll(@Query() query: ListOrdersQueryDto) {
    return this.labOrderService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab order by ID with items and fields' })
  findOne(@Param('id') id: string) {
    return this.labOrderService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lab order (e.g. status)' })
  update(@Param('id') id: string, @Body() dto: UpdateLabOrderDto) {
    return this.labOrderService.update(id, dto);
  }
}
