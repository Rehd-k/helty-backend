import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import {
  RADIOLOGY_REQUEST_READ_ACCESS,
  RADIOLOGY_REQUEST_WRITE_ACCESS,
} from './radiology.constants';
import { RadiologyRequestService } from './radiology-request.service';
import { CreateRadiologyRequestDto } from './dto/create-radiology-request.dto';
import { UpdateRadiologyRequestDto } from './dto/update-radiology-request.dto';
import { UpdateRadiologyOrderItemDto } from './dto/update-radiology-order-item.dto';
import { ListRadiologyRequestsQueryDto } from './dto/list-radiology-requests-query.dto';

@ApiTags('Radiology - Requests')
@Controller('radiology/orders')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RadiologyRequestController {
  constructor(
    private readonly radiologyRequestService: RadiologyRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary: 'Create a radiology order with one or more items',
  })
  create(
    @Body() dto: CreateRadiologyRequestDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.radiologyRequestService.create(dto, req.user.sub);
  }

  @Get()
  @AccountTypes(...RADIOLOGY_REQUEST_READ_ACCESS)
  @ApiOperation({
    summary: 'List radiology orders with optional filters (worklist)',
  })
  findAll(@Query() query: ListRadiologyRequestsQueryDto) {
    return this.radiologyRequestService.findAll(query);
  }

  @Get(':id')
  @AccountTypes(...RADIOLOGY_REQUEST_READ_ACCESS)
  @ApiOperation({
    summary: 'Get one radiology order with items and workflow artifacts',
  })
  findOne(@Param('id') id: string) {
    return this.radiologyRequestService.findOne(id);
  }

  @Patch(':orderId/items/:itemId')
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Update a radiology order item. Cancelling removes its invoice line and recalculates when allowed.',
  })
  updateItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRadiologyOrderItemDto,
  ) {
    return this.radiologyRequestService.updateItem(orderId, itemId, dto);
  }

  @Delete(':orderId/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Delete one radiology order item and remove its invoice line when allowed',
  })
  removeItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.radiologyRequestService.removeItem(orderId, itemId);
  }

  @Patch(':id')
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Update radiology order (e.g. status). Cancelling removes billed lines and recalculates the invoice when allowed.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateRadiologyRequestDto) {
    return this.radiologyRequestService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Delete a radiology order and remove its billed lines from open invoices',
  })
  remove(@Param('id') id: string) {
    return this.radiologyRequestService.remove(id);
  }
}
