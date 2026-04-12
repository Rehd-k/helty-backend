import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { NursesDashboardQueryDto } from './dto/nurses-dashboard-query.dto';
import { NursesDashboardService } from './nurses-dashboard.service';

@ApiTags('Nurses dashboard')
@ApiBearerAuth()
@AccountTypes('NURSE')
@Controller('nurses/dashboard')
export class NursesDashboardController {
  constructor(private readonly nursesDashboard: NursesDashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Nurse dashboard overview (KPIs, charts, staff, alerts)',
    description:
      'Aggregated payload for the mobile nurse home screen. Deltas compare the selected window to the immediately previous window of equal length (UTC boundaries).',
  })
  @ApiOkResponse({ description: 'Overview JSON (camelCase)' })
  overview(
    @Query() query: NursesDashboardQueryDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.nursesDashboard.overview(
      query.timeRange,
      query.asOf,
      req.user.sub,
    );
  }
}
