import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyRequestService } from './radiology-request.service';
import { ListRadiologyRequestsQueryDto } from './dto/list-radiology-requests-query.dto';

@ApiTags('Radiology – Worklist')
@Controller('radiology/worklist')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(
  'RADIOLOGIST',
  'RADIOGRAPHER',
  'RADIOLOGY_RECEPTIONIST',
  'RADIOLOGY',
)
export class RadiologyWorklistController {
  constructor(
    private readonly radiologyRequestService: RadiologyRequestService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get radiology worklist (queue of pending/scheduled/in progress/completed/reported orders)',
  })
  getWorklist(@Query() query: ListRadiologyRequestsQueryDto) {
    return this.radiologyRequestService.findAll(query);
  }
}
