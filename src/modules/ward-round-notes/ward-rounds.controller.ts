import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { WardRoundsService } from './ward-rounds.service';

@ApiTags('Ward rounds')
@Controller('ward-rounds')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('INPATIENT_DOCTOR')
export class WardRoundsController {
  constructor(private readonly wardRoundsService: WardRoundsService) {}

  @Get('today')
  @ApiOperation({ summary: "Today's ward-round patients for a doctor" })
  getToday(@Query('doctorId') doctorId: string, @Query('date') date?: string) {
    return this.wardRoundsService.getToday(doctorId, date);
  }
}
