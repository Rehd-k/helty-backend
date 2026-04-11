import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyProcedureService } from './radiology-procedure.service';
import {
  CreateRadiologyProcedureDto,
  UpdateRadiologyProcedureDto,
} from './dto/radiology-procedure.dto';

@ApiTags('Radiology – Procedure')
@Controller('radiology/order-items/:orderItemId/procedure')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOGRAPHER', 'RADIOLOGY')
export class RadiologyProcedureController {
  constructor(
    private readonly radiologyProcedureService: RadiologyProcedureService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record imaging procedure (scan start) for an order item' })
  create(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: CreateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.create(orderItemId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update procedure (e.g. end time, notes)' })
  update(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpdateRadiologyProcedureDto,
  ) {
    return this.radiologyProcedureService.update(orderItemId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get procedure record for an order item' })
  getProcedure(@Param('orderItemId') orderItemId: string) {
    return this.radiologyProcedureService.getByOrderItemId(orderItemId);
  }
}
