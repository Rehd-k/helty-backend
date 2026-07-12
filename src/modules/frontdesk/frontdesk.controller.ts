import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FrontdeskService } from './frontdesk.service';
import { FrontdeskQueryDto } from './dto/frontdesk-query.dto';
import { AccountTypes } from '../../common/decorators';
import {
  FrontdeskFeedbackQueryDto,
  UpdateFrontdeskFeedbackDto,
} from './dto/frontdesk-feedback.dto';

@ApiTags('Frontdesk')
@Controller('frontdesk')
export class FrontdeskController {
  constructor(private readonly frontdesk: FrontdeskService) {}

  @Get('dashboard/summary')
  @ApiOperation({
    summary: 'Frontdesk dashboard KPIs',
    description:
      'Appointments today vs yesterday (% change), check-ins (waiting list rows created today), waiting room (paid Consultations & Reviews on today’s invoices, no ongoing OPD encounter), discharges today.',
  })
  @ApiOkResponse({ description: 'Dashboard summary' })
  summary(@Query() q: FrontdeskQueryDto) {
    return this.frontdesk.dashboardSummary(q.asOf);
  }

  @Get('dashboard/queue')
  @ApiOperation({
    summary: 'Live patient queue for frontdesk table',
    description:
      'Waiting patients (seen=false) today plus ongoing outpatient encounters today; deduped by patient with encounter taking precedence.',
  })
  @ApiOkResponse({ description: 'Ordered queue rows' })
  queue(@Query() q: FrontdeskQueryDto) {
    return this.frontdesk.liveQueue(q.asOf);
  }

  @Get('feedback')
  @AccountTypes('FRONTDESK', 'FRONT_DESK', 'CMAC')
  @ApiOperation({ summary: 'List patient feedback for frontdesk review' })
  @ApiOkResponse({ description: 'Patient feedback list' })
  feedback(@Query() q: FrontdeskFeedbackQueryDto) {
    return this.frontdesk.listFeedback(q);
  }

  @Get('feedback/:id')
  @AccountTypes('FRONTDESK', 'FRONT_DESK', 'CMAC')
  @ApiOperation({ summary: 'Get patient feedback detail' })
  @ApiOkResponse({ description: 'Patient feedback detail' })
  feedbackDetail(@Param('id') id: string) {
    return this.frontdesk.getFeedback(id);
  }

  @Patch('feedback/:id')
  @AccountTypes('FRONTDESK', 'FRONT_DESK', 'CMAC')
  @ApiOperation({ summary: 'Update patient feedback status or response' })
  @ApiOkResponse({ description: 'Patient feedback updated' })
  updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFrontdeskFeedbackDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.frontdesk.updateFeedback(id, dto, req.user.sub);
  }
}
