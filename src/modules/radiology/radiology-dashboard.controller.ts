import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyDashboardService } from './radiology-dashboard.service';
import { RadiologyDashboardQueryDto } from './dto/radiology-dashboard-query.dto';

@ApiTags('Radiology – Dashboard')
@Controller('radiology/dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOLOGIST', 'RADIOLOGY_RECEPTIONIST', 'RADIOLOGY')
export class RadiologyDashboardController {
  constructor(
    private readonly radiologyDashboardService: RadiologyDashboardService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get radiology dashboard counts (scans in range, pending, completed, waiting reports, urgent)',
  })
  getDashboard(@Query() query: RadiologyDashboardQueryDto) {
    return this.radiologyDashboardService.getDashboard(query);
  }
}
