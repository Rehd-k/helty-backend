import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyDashboardService } from './radiology-dashboard.service';

@ApiTags('Radiology – Dashboard')
@Controller('radiology/dashboard')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('RADIOLOGIST', 'RADIOLOGY_RECEPTIONIST', 'RADIOLOGY')
export class RadiologyDashboardController {
  constructor(private readonly radiologyDashboardService: RadiologyDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get radiology dashboard counts (today, pending, completed, waiting reports, urgent)' })
  getDashboard() {
    return this.radiologyDashboardService.getDashboard();
  }
}
