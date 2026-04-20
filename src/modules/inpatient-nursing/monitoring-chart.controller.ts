import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { MonitoringChartService } from './monitoring-chart.service';
import {
  CreateMonitoringChartDto,
  UpdateMonitoringChartDto,
} from './dto/nursing-docs.dto';

@ApiTags('Inpatient — monitoring charts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/monitoring-charts')
export class MonitoringChartController {
  constructor(private readonly service: MonitoringChartService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List monitoring chart entries' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Create monitoring chart entry' })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateMonitoringChartDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub);
  }

  @Patch(':chartId')
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @ApiOperation({ summary: 'Update own monitoring chart entry' })
  update(
    @Param('admissionId') admissionId: string,
    @Param('chartId') chartId: string,
    @Body() dto: UpdateMonitoringChartDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.update(admissionId, chartId, dto, req.user.sub);
  }
}
