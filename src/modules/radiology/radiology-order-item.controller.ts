import {
  Controller,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RADIOLOGY_REQUEST_WRITE_ACCESS } from './radiology.constants';
import { RadiologyRequestService } from './radiology-request.service';
import { UpdateRadiologyOrderItemDto } from './dto/update-radiology-order-item.dto';

@ApiTags('Radiology - Order Items')
@Controller('radiology/order-items')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RadiologyOrderItemController {
  constructor(
    private readonly radiologyRequestService: RadiologyRequestService,
  ) {}

  @Patch(':id')
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Update a radiology order item by id (status and clinical fields). Cancelling removes its invoice line when allowed.',
  })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateRadiologyOrderItemDto,
  ) {
    return this.radiologyRequestService.updateItemById(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @AccountTypes(...RADIOLOGY_REQUEST_WRITE_ACCESS)
  @ApiOperation({
    summary:
      'Delete one radiology order item by id and remove its invoice line when allowed',
  })
  removeItem(@Param('id') id: string) {
    return this.radiologyRequestService.removeItemById(id);
  }
}
