import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FrontdeskService } from './frontdesk.service';
import { FrontdeskQueryDto } from './dto/frontdesk-query.dto';

@ApiTags('Frontdesk')
@Controller('frontdesk/dashboard')
export class FrontdeskController {
  constructor(private readonly frontdesk: FrontdeskService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Frontdesk dashboard KPIs',
    description:
      'Appointments today vs yesterday (% change), check-ins (waiting list rows created today), waiting room (paid Consultations & Reviews on today’s invoices, no ongoing OPD encounter), discharges today.',
  })
  @ApiOkResponse({ description: 'Dashboard summary' })
  summary(@Query() q: FrontdeskQueryDto) {
    return this.frontdesk.dashboardSummary(q.asOf);
  }

  @Get('queue')
  @ApiOperation({
    summary: 'Live patient queue for frontdesk table',
    description:
      'Waiting patients (seen=false) today plus ongoing outpatient encounters today; deduped by patient with encounter taking precedence.',
  })
  @ApiOkResponse({ description: 'Ordered queue rows' })
  queue(@Query() q: FrontdeskQueryDto) {
    return this.frontdesk.liveQueue(q.asOf);
  }
}
