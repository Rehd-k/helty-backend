import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { NURSING_ACCESS } from '../nursing/nursing.constants';
import { NursesDashboardQueryDto } from './dto/nurses-dashboard-query.dto';
import { NursesDashboardService } from './nurses-dashboard.service';

@ApiTags('Nurses dashboard')
@ApiBearerAuth()
@AccountTypes(...NURSING_ACCESS)
@Controller('nurses/dashboard')
export class NursesDashboardController {
  constructor(private readonly nursesDashboard: NursesDashboardService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Nursing role bootstrap (capabilities, unit, default dashboard)',
  })
  me(@Req() req: { user: { sub: string } }) {
    return this.nursesDashboard.me(req.user.sub);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Role-aware nurse dashboard overview',
    description:
      'Routes to matron, charge, line, or hospital overview based on staffRole. Deltas compare the selected window to the immediately previous window of equal length (UTC boundaries).',
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

  @Get('matron/overview')
  @AccountTypes('MATRON', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Matron hospital-wide nursing dashboard' })
  matronOverview(
    @Query() query: NursesDashboardQueryDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.nursesDashboard.matronOverview(
      query.timeRange,
      query.asOf,
      req.user.sub,
    );
  }

  @Get('charge/overview')
  @AccountTypes('NURSING_CHARGE')
  @ApiOperation({ summary: 'Charge nurse unit-scoped dashboard' })
  chargeOverview(
    @Query() query: NursesDashboardQueryDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.nursesDashboard.chargeOverview(
      query.timeRange,
      query.asOf,
      req.user.sub,
    );
  }

  @Get('line/overview')
  @ApiOperation({ summary: 'Line nurse personal assignments dashboard' })
  lineOverview(
    @Query() query: NursesDashboardQueryDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.nursesDashboard.lineOverview(
      query.timeRange,
      query.asOf,
      req.user.sub,
    );
  }
}
