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
import { CLINICAL_READ_ACCESS } from '../../common/constants/clinical-access.constants';
import { RADIOLOGY_REPORT_WRITE_ACCESS } from './radiology.constants';
import { RadiologyReportService } from './radiology-report.service';
import {
  CreateRadiologyStudyReportDto,
  UpdateRadiologyStudyReportDto,
} from './dto/radiology-report.dto';

@ApiTags('Radiology – Reporting')
@Controller('radiology/order-items/:orderItemId/report')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RadiologyReportController {
  constructor(
    private readonly radiologyReportService: RadiologyReportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...RADIOLOGY_REPORT_WRITE_ACCESS)
  @ApiOperation({
    summary: 'Create radiology report (digitally signed by radiologist)',
  })
  create(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: CreateRadiologyStudyReportDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    const signedById = req.user?.sub;
    if (!signedById) {
      throw new Error('Unauthorized');
    }
    return this.radiologyReportService.create(orderItemId, dto, signedById);
  }

  @Patch()
  @AccountTypes(...RADIOLOGY_REPORT_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update radiology report' })
  update(
    @Param('orderItemId') orderItemId: string,
    @Body() dto: UpdateRadiologyStudyReportDto,
  ) {
    return this.radiologyReportService.update(orderItemId, dto);
  }

  @Get()
  @AccountTypes(...CLINICAL_READ_ACCESS)
  @ApiOperation({ summary: 'Get report for an order item (for viewing/print)' })
  getReport(@Param('orderItemId') orderItemId: string) {
    return this.radiologyReportService.getByOrderItemId(orderItemId);
  }
}
