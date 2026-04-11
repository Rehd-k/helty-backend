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
import { RadiologyScheduleService } from './radiology-schedule.service';
import {
  CreateRadiologyScheduleDto,
  UpdateRadiologyScheduleDto,
} from './dto/radiology-schedule.dto';

@ApiTags('Radiology – Scheduling')
@Controller('radiology/order-items/:orderItemId/schedule')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOLOGY_RECEPTIONIST', 'RADIOGRAPHER', 'RADIOLOGY')
export class RadiologyScheduleController {
  constructor(
    private readonly radiologyScheduleService: RadiologyScheduleService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule an imaging procedure for an order item' })
  create(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: CreateRadiologyScheduleDto,
  ) {
    return this.radiologyScheduleService.create(orderItemId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Reschedule or update schedule' })
  update(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpdateRadiologyScheduleDto,
  ) {
    return this.radiologyScheduleService.update(orderItemId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get schedule for an order item' })
  getSchedule(@Param('orderItemId') orderItemId: string) {
    return this.radiologyScheduleService.getByOrderItemId(orderItemId);
  }
}
