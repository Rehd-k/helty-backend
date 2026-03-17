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
@Controller('radiology/requests/:requestId/schedule')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOLOGY_RECEPTIONIST', 'RADIOGRAPHER', 'RADIOLOGY')
export class RadiologyScheduleController {
  constructor(
    private readonly radiologyScheduleService: RadiologyScheduleService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule an imaging procedure for a request' })
  create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateRadiologyScheduleDto,
  ) {
    return this.radiologyScheduleService.create(requestId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Reschedule or update schedule' })
  update(
    @Param('requestId') requestId: string,
    @Body() dto: UpdateRadiologyScheduleDto,
  ) {
    return this.radiologyScheduleService.update(requestId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get schedule for a request' })
  getSchedule(@Param('requestId') requestId: string) {
    return this.radiologyScheduleService.getByRequestId(requestId);
  }
}
