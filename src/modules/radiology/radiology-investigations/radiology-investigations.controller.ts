import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../../common/guards';
import { AccountTypes } from '../../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../../common/constants/clinical-access.constants';
import { RadiologyInvestigationsService } from './radiology-investigations.service';
import { RadiologyInvestigationsQueryDto } from './dto/radiology-investigations-query.dto';

@ApiTags('Radiology – Investigations')
@Controller('radiology/investigations')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...CLINICAL_READ_ACCESS)
export class RadiologyInvestigationsController {
  constructor(
    private readonly radiologyInvestigationsService: RadiologyInvestigationsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Radiology investigations summary (counts, amounts, by scan and department)',
  })
  getSummary(@Query() query: RadiologyInvestigationsQueryDto) {
    return this.radiologyInvestigationsService.getSummary(query);
  }

  @Get()
  @ApiOperation({
    summary: 'Paginated radiology investigations list with filters and sorters',
  })
  list(@Query() query: RadiologyInvestigationsQueryDto) {
    return this.radiologyInvestigationsService.list(query);
  }
}
