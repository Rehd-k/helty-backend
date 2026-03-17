import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyReportService } from './radiology-report.service';
import {
  CreateRadiologyReportDto,
  UpdateRadiologyReportDto,
} from './dto/radiology-report.dto';

@ApiTags('Radiology – Reporting')
@Controller('radiology/requests/:requestId/report')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes('CONSULTANT', 'INPATIENT_DOCTOR', 'RADIOLOGIST', 'RADIOLOGY')
export class RadiologyReportController {
  constructor(
    private readonly radiologyReportService: RadiologyReportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create radiology report (digitally signed by radiologist)',
  })
  create(
    @Param('requestId') requestId: string,
    @Body() dto: CreateRadiologyReportDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    const signedById = req.user?.sub;
    if (!signedById) {
      throw new Error('Unauthorized');
    }
    return this.radiologyReportService.create(requestId, dto, signedById);
  }

  @Patch()
  @ApiOperation({ summary: 'Update radiology report' })
  update(
    @Param('requestId') requestId: string,
    @Body() dto: UpdateRadiologyReportDto,
  ) {
    return this.radiologyReportService.update(requestId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get report for a request (for viewing/print)' })
  getReport(@Param('requestId') requestId: string) {
    return this.radiologyReportService.getByRequestId(requestId);
  }
}
