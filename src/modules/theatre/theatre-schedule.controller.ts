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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { THEATRE_ACCESS } from './theatre.constants';
import { TheatreScheduleService } from './theatre-schedule.service';
import {
  ListTheatreSchedulesQueryDto,
  ScheduleSurgeryDto,
  UpdateTheatreScheduleDto,
} from './dto/theatre.dto';

@ApiTags('Theatre – Schedules')
@Controller('theatre/schedules')
@UseGuards(JwtAuthGuard, AccessGuard)
export class TheatreScheduleController {
  constructor(
    private readonly theatreScheduleService: TheatreScheduleService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...THEATRE_ACCESS)
  @ApiOperation({ summary: 'Schedule a surgery request' })
  create(@Body() dto: ScheduleSurgeryDto) {
    return this.theatreScheduleService.create(dto);
  }

  @Get()
  @AccountTypes(...THEATRE_ACCESS)
  @ApiOperation({ summary: 'List theatre schedules' })
  findAll(@Query() query: ListTheatreSchedulesQueryDto) {
    return this.theatreScheduleService.findAll(query);
  }

  @Patch(':id')
  @AccountTypes(...THEATRE_ACCESS)
  @ApiOperation({ summary: 'Reschedule or update theatre assignment' })
  update(@Param('id') id: string, @Body() dto: UpdateTheatreScheduleDto) {
    return this.theatreScheduleService.update(id, dto);
  }
}
