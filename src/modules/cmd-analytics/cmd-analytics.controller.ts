import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { CmdAnalyticsService } from './cmd-analytics.service';
import { CmdAnalyticsQueryDto } from './dto/cmd-analytics-query.dto';
import { CmdBroadcastDto } from './dto/cmd-broadcast.dto';

@ApiTags('CMD Analytics')
@ApiBearerAuth()
@AccountTypes('CMD', 'CMAC', 'SUPER_ADMIN')
@Controller('cmd')
export class CmdAnalyticsController {
  constructor(private readonly service: CmdAnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Executive dashboard payload for CMD' })
  dashboard(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.dashboard(q);
  }

  @Get('hospital/overview')
  hospitalOverview(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.hospitalOverview(q);
  }

  @Get('financial/overview')
  financialOverview(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.financialOverview(q);
  }

  @Get('staff/oversight')
  staffOversight(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.staffOversight(q);
  }

  @Get('beds/snapshot')
  bedsSnapshot() {
    return this.service.bedsSnapshot();
  }

  @Get('lab/monitoring')
  labMonitoring(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.labMonitoring(q);
  }

  @Get('alerts')
  alerts(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.alerts(q);
  }

  @Get('reports/templates')
  reportTemplates() {
    return this.service.reportTemplates();
  }

  @Get('audit/logs')
  auditLogs(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.auditLogs(q);
  }

  @Get('approvals/pending')
  approvalsPending(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.approvalsPending(q);
  }

  @Get('communications')
  communications(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.communications(q);
  }

  @Post('communications/broadcast')
  @HttpCode(HttpStatus.CREATED)
  broadcast(@Body() dto: CmdBroadcastDto) {
    return this.service.broadcast(dto);
  }

  @Get('patient-experience')
  patientExperience(@Query() q: CmdAnalyticsQueryDto) {
    return this.service.patientExperience(q);
  }

  @Get('settings/overview')
  settingsOverview() {
    return this.service.settingsOverview();
  }
}
