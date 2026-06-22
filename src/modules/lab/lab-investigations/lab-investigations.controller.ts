import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../../common/guards';
import { AccountTypes } from '../../../common/decorators';
import { CLINICAL_READ_ACCESS } from '../../../common/constants/clinical-access.constants';
import { LabInvestigationsService } from './lab-investigations.service';
import { LabInvestigationsQueryDto } from './dto/lab-investigations-query.dto';

@ApiTags('Lab – Investigations')
@Controller('lab/investigations')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(...CLINICAL_READ_ACCESS)
export class LabInvestigationsController {
  constructor(
    private readonly labInvestigationsService: LabInvestigationsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Lab investigations summary (counts, amounts, by test name and department)',
  })
  getSummary(@Query() query: LabInvestigationsQueryDto) {
    return this.labInvestigationsService.getSummary(query);
  }

  @Get()
  @ApiOperation({
    summary: 'Paginated lab investigations list with filters and sorters',
  })
  list(@Query() query: LabInvestigationsQueryDto) {
    return this.labInvestigationsService.list(query);
  }
}
